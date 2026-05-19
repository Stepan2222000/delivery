"""LLM client + prompt assembly for unknown-track lookup.

Talks to an OpenAI-compatible endpoint (cursor-gpt55 / gpt-5.5). Vision
images are passed as base64 data URLs — the upstream endpoint does not
fetch external URLs.

Returns a single structured JSON message per AI turn:
  { direct_match: {order_id, evidence} | null,
    candidates: [{order_id, reason, confidence}],
    questions: [str],
    reasoning: str }
"""
from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator

import asyncpg
import httpx
from minio import Minio
from openai import AsyncOpenAI

from .config import settings


SYSTEM_PROMPT = """Ты — ассистент логистической команды. Тебе показывают
посылку, для которой неизвестно, какому из активных заказов eBay она
соответствует. Твоя задача — сопоставить её с заказом по фото и метаданным.

Правила:
- Не выдумывай совпадений. Если уверенности нет — задавай уточняющие вопросы.
- direct_match заполняй ТОЛЬКО когда есть прямое доказательство:
    * номер трека виден на фото и совпадает с одним из треков заказа;
    * SKU/штрихкод/PN на запчасти совпадает с item_title (или его кодом);
    * нескольких признаков (продавец + дата отправки + тип товара) хватает
      для однозначного вывода.
- В candidates перечисляй кандидатов с частичными совпадениями
  (например, совпала только дата заказа или только тип запчасти).
- Если совпадений нет вообще и кандидатов предложить не можешь —
  оставляй direct_match=null, candidates=[], и задавай конкретные questions.
- В reasoning кратко (1–3 предложения) объясни логику.
- Учёт идёт ТОЛЬКО для запчастей. Если на фото явно не запчасть — отметь
  это в reasoning (но всё равно попробуй сопоставить, форвардер решит сам).
- Не раскрывай в reasoning внутренние цены/комиссии без необходимости.
- Отвечай на русском.
"""

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "direct_match": {
            "type": ["object", "null"],
            "properties": {
                "order_id": {"type": "integer"},
                "evidence": {"type": "string"},
            },
            "required": ["order_id", "evidence"],
            "additionalProperties": False,
        },
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer"},
                    "reason": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["order_id", "reason", "confidence"],
                "additionalProperties": False,
            },
        },
        "questions": {"type": "array", "items": {"type": "string"}},
        "reasoning": {"type": "string"},
    },
    "required": ["direct_match", "candidates", "questions", "reasoning"],
    "additionalProperties": False,
}


def make_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        timeout=httpx.Timeout(120.0, connect=15.0),
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

ACTIVE_ORDERS_SQL = """
WITH active_tns AS (
    SELECT p.tracking_number, p.status, p.arrived_kg_at, p.delivered_ru_at,
           p.shipment_usa_to_kg_id, p.shipment_kg_to_ru_id, p.weight_kg
      FROM parcels p
     WHERE p.status <> 'cancelled'
       AND p.status <> 'not_received_ru'
       AND (p.status <> 'delivered_ru' OR p.delivered_ru_at > $1)
),
active_track_pairs AS (
    SELECT t.order_id, t.tracking_number
      FROM ebay_remote.order_tracking_numbers t
      JOIN active_tns a USING (tracking_number)
    UNION ALL
    SELECT o.order_id, unnest(o.delivery_extra_tracks)
      FROM ebay_remote.orders o
     WHERE o.delivery_extra_tracks IS NOT NULL
       AND array_length(o.delivery_extra_tracks, 1) > 0
),
relevant_orders AS (
    SELECT DISTINCT order_id FROM active_track_pairs
)
SELECT
    o.order_id,
    o.order_number,
    o.sold_by,
    o.ordered_at,
    o.delivery_status,
    o.delivered_date,
    o.arriving_by_date,
    (SELECT array_agg(t2.tracking_number)
       FROM ebay_remote.order_tracking_numbers t2 WHERE t2.order_id = o.order_id) AS source_tracks,
    o.delivery_extra_tracks AS extra_tracks,
    (SELECT array_agg(i.item_title ORDER BY i.item_title)
       FROM ebay_remote.order_items i WHERE i.order_id = o.order_id) AS items
  FROM ebay_remote.orders o
 WHERE o.order_id IN (SELECT order_id FROM relevant_orders)
"""


async def gather_active_orders(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=14)
    async with pool.acquire() as conn:
        rows = await conn.fetch(ACTIVE_ORDERS_SQL, cutoff)
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append({
            "order_id": r["order_id"],
            "order_number": r["order_number"],
            "sold_by": r["sold_by"],
            "ordered_at": r["ordered_at"].isoformat() if r["ordered_at"] else None,
            "delivery_status": r["delivery_status"],
            "delivered_date": r["delivered_date"].isoformat() if r["delivered_date"] else None,
            "arriving_by_date": r["arriving_by_date"],
            "source_tracks": list(r["source_tracks"] or []),
            "extra_tracks": list(r["extra_tracks"] or []),
            "items": list(r["items"] or []),
        })
    return out


def fetch_photo_as_data_url(minio: Minio, bucket: str, object_key: str, mime: str) -> str:
    obj = minio.get_object(bucket, object_key)
    try:
        data = obj.read()
    finally:
        obj.close()
        obj.release_conn()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build_messages(
    *,
    active_orders: list[dict[str, Any]],
    request_row: asyncpg.Record,
    chat_history: list[asyncpg.Record],
    initial_photos_as_data_urls: list[str],
) -> list[dict[str, Any]]:
    """Build the messages list for an OpenAI-compatible chat call."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Context block — sent once as a user message at the top of the chat.
    ctx = {
        "request": {
            "id": str(request_row["id"]),
            "tracking_number": request_row["tracking_number"],
            "note": request_row["note"],
            "created_by": request_row["created_by"],
            "created_at": request_row["created_at"].isoformat(),
        },
        "active_orders": active_orders,
    }
    first_user_content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                "Контекст. Заявка на сопоставление неизвестного трека.\n"
                + json.dumps(ctx, ensure_ascii=False, default=str)
                + ("\n\nФото к заявке прикреплены ниже." if initial_photos_as_data_urls else "")
            ),
        },
    ]
    for url in initial_photos_as_data_urls:
        first_user_content.append({"type": "image_url", "image_url": {"url": url}})

    messages.append({"role": "user", "content": first_user_content})

    # Replay chat history (oldest first). Assistant messages re-use their
    # stored structured output so the model sees its own prior decisions.
    for m in chat_history:
        if m["role"] == "user":
            parts: list[dict[str, Any]] = []
            if m["content_text"]:
                parts.append({"type": "text", "text": m["content_text"]})
            atts = m["attachments"] or []
            for att in atts:
                # data_url is pre-computed when the message is being built for LLM
                if "data_url" in att:
                    parts.append({"type": "image_url", "image_url": {"url": att["data_url"]}})
            if not parts:
                continue
            messages.append({"role": "user", "content": parts})
        elif m["role"] == "assistant":
            structured = m["structured"]
            messages.append({
                "role": "assistant",
                "content": json.dumps(structured, ensure_ascii=False)
                if structured else (m["content_text"] or ""),
            })

    return messages


async def call_llm_structured(
    client: AsyncOpenAI, messages: list[dict[str, Any]]
) -> dict[str, Any]:
    """One-shot non-streaming call returning the parsed structured output."""
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "lookup_response",
                "strict": True,
                "schema": RESPONSE_SCHEMA,
            },
        },
    )
    content = resp.choices[0].message.content or "{}"
    return json.loads(content)


async def stream_llm_text(
    client: AsyncOpenAI, messages: list[dict[str, Any]]
) -> AsyncIterator[str]:
    """Streaming text deltas (used when we want token-by-token UI output).
    Not used by the structured path — kept for potential later use.
    """
    stream = await client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
