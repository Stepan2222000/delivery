"""Sync worker: ebay_orders → delivery.parcels.

Runs on a fixed interval. Idempotent: pulls the full set of orders ≥ cutoff
from ebay_remote (FDW), upserts one parcel per (order, tracking_number) pair.

For UNINSERTED (new) parcels:
  - status = 'ordered' if no delivered_date
  - if delivered_date is set, randomly pick one of the downstream statuses to seed
    the system with realistic data (per user's request: "по статусам раскидаем
    рандомно ради моков, потом данные поменяю все").

For EXISTING parcels:
  - update only `sold_by`, `item_title`, `order_total_usd`, `eta_usa`,
    `arrived_usa_at`. Never overwrite status/weight/shipment ids — those are owned
    by the delivery system.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from eta_parser import parse_eta  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sync] %(levelname)s %(message)s",
)
log = logging.getLogger("sync")

DSN = os.environ["DELIVERY_PG_DSN"]
INTERVAL_MIN = int(os.environ.get("SYNC_INTERVAL_MINUTES", "5"))

# Realistic distribution for already-delivered orders (random seed for moks).
DOWNSTREAM_WEIGHTS = [
    ("arrived_usa", 25),
    ("received_by_forwarder_usa", 15),
    ("arrived_kg", 25),
    ("in_shipment_kg_to_ru", 15),
    ("delivered_ru", 20),
]


def random_seeded_status() -> str:
    pool = []
    for s, w in DOWNSTREAM_WEIGHTS:
        pool.extend([s] * w)
    return random.choice(pool)


SQL_FETCH = """
SELECT
    o.order_id,
    o.order_number,
    o.sold_by,
    o.ordered_at,
    o.order_total_usd,
    o.delivery_status,
    o.delivered_date,
    o.arriving_by_date,
    o.is_untracked,
    t.tracking_number,
    (SELECT i.item_title FROM ebay_remote.order_items i
        WHERE i.order_id = o.order_id LIMIT 1) AS item_title
FROM ebay_remote.orders o
JOIN ebay_remote.order_tracking_numbers t USING (order_id)
WHERE o.is_untracked = false
  AND o.ordered_at IS NOT NULL
  AND o.ordered_at >= (SELECT cutoff_date::timestamptz FROM settings WHERE id = 1)
"""


async def sync_once(pool: asyncpg.Pool) -> dict:
    inserted = 0
    updated = 0
    skipped_cancelled = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch(SQL_FETCH)
        log.info("fetched %d (order, tracking) pairs from ebay_remote", len(rows))
        for r in rows:
            tn = r["tracking_number"]
            if not tn:
                continue
            # Skip cancelled orders entirely on first import.
            if r["delivery_status"] and "cancel" in r["delivery_status"].lower():
                skipped_cancelled += 1
                continue
            existing = await conn.fetchrow(
                "SELECT tracking_number FROM parcels WHERE tracking_number = $1", tn
            )
            ordered_at = r["ordered_at"] or datetime.now(tz=timezone.utc)
            eta = parse_eta(r["arriving_by_date"], ordered_at)
            arrived_usa = (
                datetime.combine(r["delivered_date"], datetime.min.time(), tzinfo=timezone.utc)
                if r["delivered_date"] else None
            )
            if existing is None:
                status = "ordered"
                if r["delivered_date"] is not None:
                    status = random_seeded_status()
                # Derive intermediate dates if downstream status was seeded.
                received_usa = arrived_usa if status in {
                    "received_by_forwarder_usa", "arrived_kg",
                    "in_shipment_kg_to_ru", "delivered_ru",
                } else None
                arrived_kg = (
                    received_usa if status in {"arrived_kg", "in_shipment_kg_to_ru", "delivered_ru"}
                    else None
                )
                delivered_ru = (
                    arrived_kg if status == "delivered_ru" else None
                )
                await conn.execute(
                    """
                    INSERT INTO parcels (
                        tracking_number, status, ordered_at, eta_usa,
                        arrived_usa_at, received_usa_at, arrived_kg_at, delivered_ru_at,
                        source_order_number, sold_by, item_title, order_total_usd
                    ) VALUES (
                        $1, $2::parcel_status, $3, $4, $5, $6, $7, $8,
                        $9, $10, $11, $12
                    )
                    """,
                    tn, status, ordered_at, eta,
                    arrived_usa, received_usa, arrived_kg, delivered_ru,
                    r["order_number"], r["sold_by"], r["item_title"], r["order_total_usd"],
                )
                inserted += 1
            else:
                await conn.execute(
                    """
                    UPDATE parcels
                       SET sold_by = $2,
                           item_title = $3,
                           order_total_usd = $4,
                           eta_usa = COALESCE($5, eta_usa),
                           arrived_usa_at = COALESCE(arrived_usa_at, $6)
                     WHERE tracking_number = $1
                    """,
                    tn, r["sold_by"], r["item_title"], r["order_total_usd"],
                    eta, arrived_usa,
                )
                updated += 1
    log.info("done — inserted=%d updated=%d skipped_cancelled=%d", inserted, updated, skipped_cancelled)
    return {"inserted": inserted, "updated": updated, "skipped_cancelled": skipped_cancelled}


async def main_loop():
    pool = await asyncpg.create_pool(dsn=DSN, min_size=1, max_size=3, command_timeout=60)
    try:
        while True:
            try:
                await sync_once(pool)
            except Exception as e:
                log.exception("sync iteration failed: %s", e)
                raise
            await asyncio.sleep(INTERVAL_MIN * 60)
    finally:
        await pool.close()


async def main_once():
    pool = await asyncpg.create_pool(dsn=DSN, min_size=1, max_size=3, command_timeout=60)
    try:
        return await sync_once(pool)
    finally:
        await pool.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        result = asyncio.run(main_once())
        print(result)
    else:
        asyncio.run(main_loop())
