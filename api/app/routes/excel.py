"""Excel export + two-step import (preview → apply)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..excel import STATUS_FROM_RU, build_xlsx, parse_xlsx
from ..transitions import can_forwarder_transition

router = APIRouter(tags=["excel"])


class ImportPreviewItem(BaseModel):
    tracking_number: str
    action: Literal["update", "skip", "error"]
    changes: dict
    reason: str | None = None


class ImportPreviewOut(BaseModel):
    will_update: int
    skipped: int
    errors: int
    items: list[ImportPreviewItem]


class ImportApplyIn(BaseModel):
    items: list[ImportPreviewItem]


@router.get("/export.xlsx")
async def export_xlsx(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    ids: str | None = None,  # comma-separated tracking_numbers
):
    pool: asyncpg.Pool = request.app.state.pool
    where = ""
    args: list = []
    if ids:
        tns = [t.strip() for t in ids.split(",") if t.strip()]
        if tns:
            args.append(tns)
            where = "WHERE p.tracking_number = ANY($1::text[])"
    sql = f"""
        SELECT p.tracking_number, p.status, p.ordered_at,
               p.arrived_usa_at, p.received_usa_at, p.arrived_kg_at,
               (SELECT s.sent_at FROM shipments s WHERE s.id = p.shipment_kg_to_ru_id) AS sent_ru_at,
               p.delivered_ru_at, p.weight_kg, p.notes
          FROM parcels p
          {where}
         ORDER BY p.ordered_at DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    data = build_xlsx([dict(r) for r in rows])
    fname = f"delivery-tracks-{datetime.now(tz=timezone.utc).date().isoformat()}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


async def _build_preview(pool: asyncpg.Pool, parsed: list[dict], role: str) -> ImportPreviewOut:
    # Look up current state for all referenced TNs in one query.
    tns = [r["tracking_number"] for r in parsed if "tracking_number" in r]
    async with pool.acquire() as conn:
        existing = await conn.fetch(
            "SELECT tracking_number, status, weight_kg, notes FROM parcels_mutations WHERE tracking_number = ANY($1::text[])",
            tns,
        )
    by_tn = {r["tracking_number"]: dict(r) for r in existing}

    items: list[ImportPreviewItem] = []
    will_update = skipped = errors = 0
    for r in parsed:
        tn = r.get("tracking_number")
        if not tn:
            errors += 1
            items.append(ImportPreviewItem(tracking_number="", action="error",
                                            changes={}, reason="no_tracking_number"))
            continue
        if tn not in by_tn:
            errors += 1
            items.append(ImportPreviewItem(tracking_number=tn, action="error",
                                            changes={}, reason="not_in_system"))
            continue
        cur = by_tn[tn]
        changes: dict = {}
        # Weight
        if "weight_kg" in r:
            v = r["weight_kg"]
            if isinstance(v, tuple) and v[0] == "__invalid__":
                errors += 1
                items.append(ImportPreviewItem(tracking_number=tn, action="error",
                                                changes={}, reason=f"invalid_weight:{v[1]}"))
                continue
            if cur["weight_kg"] is None or float(cur["weight_kg"]) != float(v):
                changes["weight_kg"] = v
        # Notes
        if "notes" in r and (cur["notes"] or "") != (r["notes"] or ""):
            changes["notes"] = r["notes"]
        # Status
        if "status" in r:
            new_s = r["status"]
            if new_s not in STATUS_FROM_RU.values():
                errors += 1
                items.append(ImportPreviewItem(tracking_number=tn, action="error",
                                                changes={}, reason=f"unknown_status:{new_s}"))
                continue
            if new_s != cur["status"]:
                if role == "forwarder" and not can_forwarder_transition(cur["status"], new_s):
                    errors += 1
                    items.append(ImportPreviewItem(tracking_number=tn, action="error",
                                                    changes={}, reason=f"forbidden_transition:{cur['status']}->{new_s}"))
                    continue
                changes["status"] = new_s
        if not changes:
            skipped += 1
            items.append(ImportPreviewItem(tracking_number=tn, action="skip",
                                            changes={}, reason="no_changes"))
            continue
        will_update += 1
        items.append(ImportPreviewItem(tracking_number=tn, action="update", changes=changes))
    return ImportPreviewOut(will_update=will_update, skipped=skipped, errors=errors, items=items)


@router.post("/import/preview", response_model=ImportPreviewOut)
async def import_preview(
    request: Request,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty_file")
    try:
        parsed = parse_xlsx(data)
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"parse_failed:{e}")
    return await _build_preview(request.app.state.pool, parsed, user.role)


@router.post("/import/apply")
async def import_apply(
    body: ImportApplyIn,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    pool: asyncpg.Pool = request.app.state.pool
    applied = 0
    async with pool.acquire() as conn:
        async with conn.transaction():
            for it in body.items:
                if it.action != "update" or not it.changes:
                    continue
                prev_status = None
                if "status" in it.changes:
                    prev_status = await conn.fetchval(
                        "SELECT status FROM parcels_mutations WHERE tracking_number = $1", it.tracking_number
                    )
                sets, args = [], []
                for field, val in it.changes.items():
                    if field == "status":
                        args.append(val)
                        sets.append(f"status = ${len(args)}::parcel_status")
                    elif field == "weight_kg":
                        args.append(val)
                        sets.append(f"weight_kg = ${len(args)}")
                    elif field == "notes":
                        args.append(val)
                        sets.append(f"notes = ${len(args)}")
                if not sets:
                    continue
                args.append(it.tracking_number)
                await conn.execute(
                    f"UPDATE parcels_mutations SET {', '.join(sets)} WHERE tracking_number = ${len(args)}",
                    *args,
                )
                if prev_status is not None and prev_status != it.changes["status"]:
                    await conn.execute(
                        """
                        INSERT INTO parcel_history (tracking_number, from_status, to_status, actor_id, note)
                        VALUES ($1, $2::parcel_status, $3::parcel_status, $4, 'xlsx import')
                        """,
                        it.tracking_number, prev_status, it.changes["status"], user.id,
                    )
                applied += 1
    return {"applied": applied}
