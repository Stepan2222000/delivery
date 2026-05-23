"""Sync worker: insert parcels_mutations rows for tracking numbers newly
seen in ebay_remote, with parsed eta_usa. All other source fields are read
live through the parcels VIEW, so this loop is the only sync path needed.
Cancelled orders are skipped on first import.
"""
from __future__ import annotations

import asyncio
import logging
import os
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


SQL_FETCH_NEW = """
WITH all_tracks AS (
    SELECT t.order_id, t.tracking_number
      FROM ebay_remote.order_tracking_numbers t
    UNION ALL
    SELECT o.order_id, unnest(o.delivery_extra_tracks)
      FROM ebay_remote.orders o
     WHERE o.delivery_extra_tracks IS NOT NULL
       AND array_length(o.delivery_extra_tracks, 1) > 0
)
SELECT
    o.order_number,
    o.ordered_at,
    o.delivery_status,
    o.delivered_date,
    o.arriving_by_date,
    at.tracking_number
FROM all_tracks at
JOIN ebay_remote.orders o USING (order_id)
LEFT JOIN parcels_mutations pm ON pm.tracking_number = at.tracking_number
WHERE o.is_untracked = false
  AND o.ordered_at IS NOT NULL
  AND o.ordered_at >= (SELECT cutoff_date::timestamptz FROM settings WHERE id = 1)
  AND pm.tracking_number IS NULL
"""


async def sync_once(pool: asyncpg.Pool) -> dict:
    inserted = 0
    skipped_cancelled = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch(SQL_FETCH_NEW)
        log.info("fetched %d unseen (order, tracking) pairs", len(rows))
        for r in rows:
            tn = r["tracking_number"]
            if not tn:
                continue
            if r["delivery_status"] and "cancel" in r["delivery_status"].lower():
                skipped_cancelled += 1
                continue
            ordered_at = r["ordered_at"] or datetime.now(tz=timezone.utc)
            eta = parse_eta(r["arriving_by_date"], ordered_at)
            await conn.execute(
                """
                INSERT INTO parcels_mutations (
                    tracking_number, status, ordered_at, eta_usa, source_order_number
                ) VALUES (
                    $1, 'ordered'::parcel_status, $2, $3, $4
                )
                """,
                tn, ordered_at, eta, r["order_number"],
            )
            inserted += 1
    log.info("done — inserted=%d skipped_cancelled=%d", inserted, skipped_cancelled)
    return {"inserted": inserted, "skipped_cancelled": skipped_cancelled}


async def main_loop():
    pool = await asyncpg.create_pool(dsn=DSN, min_size=1, max_size=3, command_timeout=60)
    try:
        while True:
            try:
                await sync_once(pool)
            except Exception as e:
                log.exception("sync iteration failed: %s", e)
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
