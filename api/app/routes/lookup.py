"""Lookup-request endpoints: manual track creation, AI-assisted matching,
admin-confirmed linking into ebay_orders.orders.delivery_extra_tracks.
"""
from __future__ import annotations

import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user, require_admin
from ..config import settings
from ..llm import (
    build_messages, call_llm_structured, fetch_photo_as_data_url,
    gather_active_orders, make_client,
)
from ..storage import public_url
from ..streaming import SSE_HEADERS, message_id, text_message_stream


router = APIRouter(prefix="/lookup", tags=["lookup"])


# ── helpers ───────────────────────────────────────────────────────────────────

MAX_BYTES = 20 * 1024 * 1024
PHOTO_TYPES = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}


def _slug(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).stem)
    return s[:60] or "file"


def _agent_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.agent_pool


def _delivery_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool


def _ebay_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.ebay_pool


async def _load_request(agent: asyncpg.Pool, rid: UUID) -> asyncpg.Record:
    async with agent.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM lookup_requests WHERE id = $1 AND deleted_at IS NULL",
            rid,
        )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lookup_not_found")
    return row


async def _photos_for_llm(
    request: Request, rid: UUID, sources: tuple[str, ...]
) -> list[str]:
    """Read photos from MinIO and return data URLs ready for LLM."""
    minio = request.app.state.minio
    async with _agent_pool(request).acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT object_key, mime_type FROM lookup_request_photos
             WHERE request_id = $1 AND source = ANY($2::text[])
             ORDER BY uploaded_at
            """,
            rid, list(sources),
        )
    bucket = settings.minio_bucket_photos
    return [fetch_photo_as_data_url(minio, bucket, r["object_key"], r["mime_type"]) for r in rows]


async def _attachment_to_data_url(
    request: Request, att: dict[str, Any]
) -> dict[str, Any]:
    """Resolve a stored attachment {object_key, mime_type} to include data_url."""
    minio = request.app.state.minio
    data_url = fetch_photo_as_data_url(
        minio, settings.minio_bucket_photos, att["object_key"], att["mime_type"]
    )
    return {**att, "data_url": data_url}


# ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateLookupIn(BaseModel):
    tracking_number: str | None = None
    note: str | None = None


class WriteMessageIn(BaseModel):
    text: str


class SubmitIn(BaseModel):
    proposed_order_id: int
    evidence: str | None = None


class ApproveIn(BaseModel):
    order_id: int                # must match the proposal or override
    tracking_number: str         # required at approve time
    evidence: str | None = None


class RejectIn(BaseModel):
    note: str | None = None


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_requests(
    request: Request,
    status_filter: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    where = ["deleted_at IS NULL"]
    args: list = []
    if status_filter:
        args.append(status_filter)
        where.append(f"status = ${len(args)}::lookup_request_status")
    sql = f"""
        SELECT lr.id, lr.tracking_number, lr.note, lr.status,
               lr.linked_order_id, lr.proposed_order_id,
               lr.created_by, lr.created_at, lr.updated_at,
               lr.submitted_by, lr.submitted_at,
               lr.decided_by, lr.decided_at,
               (SELECT count(*) FROM lookup_request_photos p WHERE p.request_id = lr.id) AS photo_count,
               (SELECT count(*) FROM ai_messages m WHERE m.request_id = lr.id AND m.role <> 'system') AS message_count
          FROM lookup_requests lr
         WHERE {' AND '.join(where)}
         ORDER BY
            CASE lr.status
                WHEN 'pending_admin' THEN 0
                WHEN 'searching'     THEN 1
                WHEN 'draft'         THEN 2
                WHEN 'rejected'      THEN 3
                WHEN 'linked'        THEN 4
            END,
            lr.updated_at DESC
    """
    async with _agent_pool(request).acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [dict(r) for r in rows]


@router.get("/badge")
async def get_badge(
    request: Request, user: CurrentUser = Depends(get_current_user),
):
    """Counts for the header badge."""
    async with _agent_pool(request).acquire() as conn:
        pending = await conn.fetchval(
            "SELECT count(*) FROM lookup_requests "
            "WHERE deleted_at IS NULL AND status = 'pending_admin'"
        )
        searching = await conn.fetchval(
            "SELECT count(*) FROM lookup_requests "
            "WHERE deleted_at IS NULL AND status = 'searching'"
        )
    return {"pending_admin": int(pending), "searching": int(searching)}


@router.post("")
async def create_request(
    body: CreateLookupIn,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    # If a tracking number is given, ensure it isn't already a real parcel.
    if body.tracking_number:
        async with _delivery_pool(request).acquire() as conn:
            exists = await conn.fetchval(
                "SELECT 1 FROM parcels WHERE tracking_number = $1", body.tracking_number
            )
        if exists:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"already_in_system:{body.tracking_number}",
            )
    async with _agent_pool(request).acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO lookup_requests (tracking_number, note, created_by)
            VALUES ($1, $2, $3)
            RETURNING id, tracking_number, note, status, created_at
            """,
            body.tracking_number, body.note, user.id,
        )
    return dict(row)


@router.get("/{rid}")
async def get_request(rid: UUID, request: Request, user: CurrentUser = Depends(get_current_user)):
    agent = _agent_pool(request)
    async with agent.acquire() as conn:
        req = await conn.fetchrow(
            "SELECT * FROM lookup_requests WHERE id = $1 AND deleted_at IS NULL", rid
        )
        if req is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "lookup_not_found")
        photos = await conn.fetch(
            "SELECT id, object_key, public_url, mime_type, source, uploaded_by, uploaded_at "
            "FROM lookup_request_photos WHERE request_id = $1 ORDER BY uploaded_at", rid,
        )
        messages = await conn.fetch(
            "SELECT id, role, author_login, content_text, attachments, structured, created_at "
            "FROM ai_messages WHERE request_id = $1 AND role <> 'system' ORDER BY created_at", rid,
        )

    # If linked, also pull the order info from ebay for display
    linked_order = None
    if req["linked_order_id"]:
        async with _delivery_pool(request).acquire() as conn:
            linked_order = await conn.fetchrow(
                "SELECT order_id, order_number, sold_by, "
                "(SELECT string_agg(item_title, ' · ') FROM ebay_remote.order_items i WHERE i.order_id = o.order_id) AS items "
                "FROM ebay_remote.orders o WHERE order_id = $1",
                req["linked_order_id"],
            )

    return {
        "request": dict(req),
        "photos": [dict(p) for p in photos],
        "messages": [
            {
                "id": m["id"],
                "role": m["role"],
                "author_login": m["author_login"],
                "content_text": m["content_text"],
                "attachments": m["attachments"],
                "structured": m["structured"],
                "created_at": m["created_at"],
            }
            for m in messages
        ],
        "linked_order": dict(linked_order) if linked_order else None,
    }


# ── photos ────────────────────────────────────────────────────────────────────

@router.post("/{rid}/photos")
async def upload_photo(
    rid: UUID,
    request: Request,
    file: UploadFile = File(...),
    source: str = Form("initial"),
    user: CurrentUser = Depends(get_current_user),
):
    if source not in ("initial", "chat"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad_source")
    if file.content_type not in PHOTO_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"bad_type:{file.content_type}")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large")

    await _load_request(_agent_pool(request), rid)  # 404 if missing

    ext = PHOTO_TYPES[file.content_type]
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
    key = f"{settings.minio_lookup_prefix}/{rid}/{ts}-{_slug(file.filename or 'file')}.{ext}"
    bucket = settings.minio_bucket_photos
    minio = request.app.state.minio
    minio.put_object(bucket, key, io.BytesIO(data), length=len(data), content_type=file.content_type)
    url = public_url(bucket, key)

    async with _agent_pool(request).acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO lookup_request_photos
                (request_id, object_key, public_url, mime_type, bytes, source, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, public_url, uploaded_at, source
            """,
            rid, key, url, file.content_type, len(data), source, user.id,
        )
    return dict(row)


# ── chat ──────────────────────────────────────────────────────────────────────

@router.post("/{rid}/messages")
async def post_user_message(
    rid: UUID,
    body: WriteMessageIn,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _load_request(_agent_pool(request), rid)
    async with _agent_pool(request).acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ai_messages (request_id, role, author_login, content_text)
            VALUES ($1, 'user', $2, $3)
            RETURNING id, role, author_login, content_text, created_at
            """,
            rid, user.id, body.text,
        )
    return dict(row)


@router.post("/{rid}/ai/run")
async def run_ai(
    rid: UUID, request: Request, user: CurrentUser = Depends(get_current_user)
):
    """Trigger one AI iteration. Returns an SSE stream in Vercel UIMessageStream
    format that emits the structured payload as a `data-suggestion` part plus
    a short text summary.
    """
    agent = _agent_pool(request)
    req = await _load_request(agent, rid)

    # bump to 'searching' if it was 'draft'
    if req["status"] == "draft":
        async with agent.acquire() as conn:
            await conn.execute(
                "UPDATE lookup_requests SET status='searching' WHERE id = $1", rid
            )

    # Gather context
    active = await gather_active_orders(_delivery_pool(request))

    # Initial photos (always) + history with chat photo data URLs resolved
    initial_urls = await _photos_for_llm(request, rid, ("initial",))

    async with agent.acquire() as conn:
        history_rows = await conn.fetch(
            "SELECT role, author_login, content_text, attachments, structured "
            "FROM ai_messages WHERE request_id = $1 AND role <> 'system' "
            "ORDER BY created_at", rid,
        )
    # Resolve chat attachments to data URLs (only for user messages)
    resolved_history: list[dict[str, Any]] = []
    for m in history_rows:
        atts = list(m["attachments"] or [])
        resolved_atts = [await _attachment_to_data_url(request, a) for a in atts]
        resolved_history.append({
            "role": m["role"],
            "author_login": m["author_login"],
            "content_text": m["content_text"],
            "attachments": resolved_atts,
            "structured": m["structured"],
        })

    messages = build_messages(
        active_orders=active,
        request_row=req,
        chat_history=resolved_history,
        initial_photos_as_data_urls=initial_urls,
    )

    async with make_client() as client:
        try:
            parsed = await call_llm_structured(client, messages)
        except Exception as e:
            # Persist a system-visible error message so the chat doesn't go silent
            async with agent.acquire() as conn:
                await conn.execute(
                    "INSERT INTO ai_messages (request_id, role, content_text) VALUES ($1, 'assistant', $2)",
                    rid, f"[ошибка llm] {e}",
                )
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"llm_error:{e}")

    # Persist assistant message
    summary = parsed.get("reasoning") or ""
    async with agent.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ai_messages (request_id, role, content_text, structured)
            VALUES ($1, 'assistant', $2, $3)
            """,
            rid, summary, parsed,
        )

    mid = message_id()
    data_part = {
        "type": "data-suggestion",
        "id": mid,
        "data": parsed,
    }
    return StreamingResponse(
        text_message_stream(summary or "(анализ ниже)", mid=mid, data_parts=[data_part]),
        headers=SSE_HEADERS,
    )


# ── workflow: submit / approve / reject / delete ──────────────────────────────

@router.post("/{rid}/submit")
async def submit_request(
    rid: UUID, body: SubmitIn, request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    agent = _agent_pool(request)
    req = await _load_request(agent, rid)
    if req["status"] not in ("searching", "rejected", "draft"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"bad_status:{req['status']}")
    async with agent.acquire() as conn:
        await conn.execute(
            """
            UPDATE lookup_requests
               SET status = 'pending_admin',
                   proposed_order_id = $2,
                   proposed_evidence = $3,
                   submitted_by = $4,
                   submitted_at = now()
             WHERE id = $1
            """,
            rid, body.proposed_order_id, body.evidence, user.id,
        )
    return {"ok": True}


@router.post("/{rid}/approve")
async def approve_request(
    rid: UUID, body: ApproveIn, request: Request,
    user: CurrentUser = Depends(require_admin),
):
    """Admin finalises the link: writes to ebay_orders.orders, ensures the
    parcel row exists in delivery, marks the request 'linked'.
    """
    agent = _agent_pool(request)
    ebay = _ebay_pool(request)
    delivery = _delivery_pool(request)
    req = await _load_request(agent, rid)
    if req["status"] in ("linked",):
        raise HTTPException(status.HTTP_409_CONFLICT, "already_linked")

    tn = body.tracking_number.strip()
    if not tn:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "tracking_required")

    # 1. Append into ebay_orders.orders.delivery_extra_tracks (idempotent)
    meta_entry = {
        "track": tn,
        "added_by_login": user.id,
        "added_at": datetime.now(tz=timezone.utc).isoformat(),
        "request_id": str(rid),
    }
    async with ebay.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchval(
                "SELECT 1 FROM orders WHERE order_id = $1", body.order_id
            )
            if not existing:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "ebay_order_not_found")
            await conn.execute(
                """
                UPDATE orders
                   SET delivery_extra_tracks = (
                         SELECT array_agg(DISTINCT x)
                           FROM unnest(delivery_extra_tracks || ARRAY[$2]::text[]) AS x
                       ),
                       delivery_extra_tracks_meta = delivery_extra_tracks_meta || $3
                 WHERE order_id = $1
                """,
                body.order_id, tn, [meta_entry],
            )

    # 2. Ensure parcel exists in delivery
    async with delivery.acquire() as conn:
        async with conn.transaction():
            cur_status = await conn.fetchval(
                "SELECT status FROM parcels_mutations WHERE tracking_number = $1", tn
            )
            if cur_status is None:
                await conn.execute(
                    """
                    INSERT INTO parcels_mutations (tracking_number, status, ordered_at, is_manual)
                    VALUES ($1, 'arrived_kg'::parcel_status, now(), false)
                    """,
                    tn,
                )
                cur_status = "arrived_kg"
            else:
                # was an orphan-manual row → keep its status, clear the flag
                await conn.execute(
                    "UPDATE parcels_mutations SET is_manual = false WHERE tracking_number = $1", tn
                )
            await conn.execute(
                """
                INSERT INTO parcel_history (tracking_number, to_status, actor_id, note)
                VALUES ($1, $2::parcel_status, $3, $4)
                """,
                tn, cur_status, user.id,
                f"linked from lookup {rid} → order {body.order_id}",
            )

    # 3. Mark request linked
    async with agent.acquire() as conn:
        await conn.execute(
            """
            UPDATE lookup_requests
               SET status = 'linked',
                   linked_order_id = $2,
                   linked_evidence = $3,
                   tracking_number = COALESCE(tracking_number, $4),
                   decided_by = $5,
                   decided_at = now()
             WHERE id = $1
            """,
            rid, body.order_id, body.evidence, tn, user.id,
        )

    return {"ok": True, "tracking_number": tn, "order_id": body.order_id}


@router.post("/{rid}/reject")
async def reject_request(
    rid: UUID, body: RejectIn, request: Request,
    user: CurrentUser = Depends(require_admin),
):
    agent = _agent_pool(request)
    req = await _load_request(agent, rid)
    if req["status"] == "linked":
        raise HTTPException(status.HTTP_409_CONFLICT, "already_linked")
    async with agent.acquire() as conn:
        await conn.execute(
            """
            UPDATE lookup_requests
               SET status = 'rejected',
                   decided_by = $2,
                   decided_at = now(),
                   linked_evidence = COALESCE(linked_evidence, $3)
             WHERE id = $1
            """,
            rid, user.id, body.note,
        )
    return {"ok": True}


@router.delete("/{rid}")
async def delete_request(
    rid: UUID, request: Request, user: CurrentUser = Depends(require_admin),
):
    async with _agent_pool(request).acquire() as conn:
        await conn.execute(
            "UPDATE lookup_requests SET deleted_at = now(), deleted_by = $2 "
            "WHERE id = $1 AND deleted_at IS NULL",
            rid, user.id,
        )
    return {"ok": True}
