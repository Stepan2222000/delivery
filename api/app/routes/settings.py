from __future__ import annotations

from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..auth import CurrentUser, get_current_user, require_admin
from ..schemas import SettingsOut, SettingsPatch, UntrackedOut

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=SettingsOut)
async def get_settings(request: Request, user: CurrentUser = Depends(get_current_user)):
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM settings WHERE id = 1")
    if row is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "settings_missing")
    return SettingsOut(**dict(row))


@router.patch("/settings", response_model=SettingsOut)
async def patch_settings(
    body: SettingsPatch,
    request: Request,
    user: CurrentUser = Depends(require_admin),
):
    pool: asyncpg.Pool = request.app.state.pool
    sets: list[str] = []
    args: list = []
    for field in (
        "tariff_usd_per_kg",
        "threshold_usa_days", "threshold_usa_enabled",
        "threshold_to_kg_days", "threshold_to_kg_enabled",
        "threshold_to_ru_days", "threshold_to_ru_enabled",
        "cutoff_date",
    ):
        v = getattr(body, field)
        if v is not None:
            args.append(v)
            sets.append(f"{field} = ${len(args)}")
    if not sets:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "nothing_to_update")

    async with pool.acquire() as conn:
        async with conn.transaction():
            if body.tariff_usd_per_kg is not None:
                now = datetime.now(tz=timezone.utc)
                await conn.execute(
                    "INSERT INTO tariffs (usd_per_kg, effective_from) VALUES ($1, $2)",
                    body.tariff_usd_per_kg, now,
                )
                args.append(now)
                sets.append(f"tariff_effective_from = ${len(args)}")
            sets.append("updated_at = now()")
            await conn.execute(f"UPDATE settings SET {', '.join(sets)} WHERE id = 1", *args)
    return await get_settings(request, user)


@router.get("/untracked", response_model=list[UntrackedOut])
async def list_untracked(
    request: Request, user: CurrentUser = Depends(require_admin)
):
    """Untracked orders projection from ebay_orders (admin-only view)."""
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT o.order_number AS source_order_number,
                   (SELECT it.item_title
                      FROM ebay_remote.order_items i
                      JOIN ebay_remote.items it ON it.item_number = i.item_number
                     WHERE i.order_id = o.order_id LIMIT 1) AS item_title,
                   o.ordered_at,
                   o.delivery_status
              FROM ebay_remote.orders o
             WHERE o.is_untracked = true
                OR NOT EXISTS (SELECT 1 FROM ebay_remote.order_tracking_numbers t WHERE t.order_id = o.order_id)
             ORDER BY o.ordered_at DESC NULLS LAST
            """
        )
    return [UntrackedOut(**dict(r)) for r in rows]
