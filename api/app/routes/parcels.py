from __future__ import annotations

from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ..auth import CurrentUser, get_current_user
from ..schemas import AdminOnlyFields, ParcelOut, ParcelPatch
from ..transitions import can_forwarder_transition

router = APIRouter(prefix="/parcels", tags=["parcels"])


PARCEL_COLS = """
    tracking_number, status, problem,
    ordered_at, eta_usa, arrived_usa_at, received_usa_at,
    shipment_usa_to_kg_id, arrived_kg_at, weight_kg,
    shipment_kg_to_ru_id, delivered_ru_at, notes,
    source_order_number, sold_by, item_title, order_total_usd,
    shipping_cost_usd_snapshot, tariff_snapshot_usd_per_kg
"""


def _row_to_parcel(row: asyncpg.Record, *, include_admin: bool, photos: list[str]) -> ParcelOut:
    p = ParcelOut(
        tracking_number=row["tracking_number"],
        status=row["status"],
        problem=row["problem"],
        ordered_at=row["ordered_at"],
        eta_usa=row["eta_usa"],
        arrived_usa_at=row["arrived_usa_at"],
        received_usa_at=row["received_usa_at"],
        shipment_usa_to_kg_id=row["shipment_usa_to_kg_id"],
        arrived_kg_at=row["arrived_kg_at"],
        weight_kg=row["weight_kg"],
        shipment_kg_to_ru_id=row["shipment_kg_to_ru_id"],
        delivered_ru_at=row["delivered_ru_at"],
        notes=row["notes"],
        photos=photos,
    )
    if include_admin:
        p.admin_only = AdminOnlyFields(
            source_order_number=row["source_order_number"],
            sold_by=row["sold_by"],
            item_title=row["item_title"],
            order_total_usd=row["order_total_usd"],
            shipping_cost_usd_snapshot=row["shipping_cost_usd_snapshot"],
            tariff_snapshot_usd_per_kg=row["tariff_snapshot_usd_per_kg"],
        )
    return p


@router.get("", response_model=list[ParcelOut])
async def list_parcels(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    q: str | None = Query(None, description="substring search"),
    status_filter: str | None = Query(None, alias="status"),
    shipment_id: str | None = Query(None),
    include_cancelled: bool = Query(False),
):
    pool: asyncpg.Pool = request.app.state.pool
    where = []
    args: list = []
    if not include_cancelled:
        where.append("p.status <> 'cancelled'")
    if status_filter:
        args.append(status_filter)
        where.append(f"p.status = ${len(args)}::parcel_status")
    if shipment_id:
        args.append(shipment_id)
        where.append(f"(p.shipment_usa_to_kg_id = ${len(args)} OR p.shipment_kg_to_ru_id = ${len(args)})")
    if q:
        args.append(f"%{q.lower()}%")
        idx = len(args)
        if user.role == "admin":
            where.append(
                f"(LOWER(p.tracking_number) LIKE ${idx} OR LOWER(p.item_title) LIKE ${idx} OR LOWER(p.source_order_number) LIKE ${idx})"
            )
        else:
            where.append(f"LOWER(p.tracking_number) LIKE ${idx}")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    sql = f"""
        SELECT {PARCEL_COLS},
               COALESCE(
                   (SELECT array_agg(public_url ORDER BY uploaded_at)
                      FROM parcel_photos ph WHERE ph.tracking_number = p.tracking_number),
                   ARRAY[]::text[]
               ) AS photos
          FROM parcels p
          {where_sql}
         ORDER BY p.ordered_at DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [
        _row_to_parcel(r, include_admin=(user.role == "admin"), photos=list(r["photos"]))
        for r in rows
    ]


@router.get("/{tracking_number}", response_model=ParcelOut)
async def get_parcel(
    tracking_number: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    pool: asyncpg.Pool = request.app.state.pool
    sql = f"""
        SELECT {PARCEL_COLS},
               COALESCE(
                   (SELECT array_agg(public_url ORDER BY uploaded_at)
                      FROM parcel_photos ph WHERE ph.tracking_number = p.tracking_number),
                   ARRAY[]::text[]
               ) AS photos
          FROM parcels p WHERE tracking_number = $1
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, tracking_number)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "parcel_not_found")
    return _row_to_parcel(row, include_admin=(user.role == "admin"), photos=list(row["photos"]))


@router.patch("/{tracking_number}", response_model=ParcelOut)
async def patch_parcel(
    tracking_number: str,
    body: ParcelPatch,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                "SELECT status FROM parcels WHERE tracking_number = $1 FOR UPDATE",
                tracking_number,
            )
            if current is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "parcel_not_found")
            from_status = current["status"]

            sets: list[str] = []
            args: list = []
            new_status = body.status

            if new_status is not None and new_status != from_status:
                if user.role == "forwarder" and not can_forwarder_transition(from_status, new_status):
                    raise HTTPException(
                        status.HTTP_403_FORBIDDEN,
                        f"forbidden_transition:{from_status}->{new_status}",
                    )
                args.append(new_status)
                sets.append(f"status = ${len(args)}::parcel_status")
                # Side-effect dates by transition.
                now_clause = "now()"
                if new_status == "arrived_usa":
                    sets.append(f"arrived_usa_at = COALESCE(arrived_usa_at, {now_clause})")
                elif new_status == "received_by_forwarder_usa":
                    sets.append(f"received_usa_at = COALESCE(received_usa_at, {now_clause})")
                elif new_status == "arrived_kg":
                    sets.append(f"arrived_kg_at = COALESCE(arrived_kg_at, {now_clause})")
                elif new_status == "delivered_ru":
                    sets.append(f"delivered_ru_at = COALESCE(delivered_ru_at, {now_clause})")

            if body.weight_kg is not None:
                args.append(body.weight_kg)
                sets.append(f"weight_kg = ${len(args)}")
            if body.notes is not None:
                args.append(body.notes)
                sets.append(f"notes = ${len(args)}")
            if body.problem is not None:
                args.append(body.problem)
                sets.append(f"problem = ${len(args)}::problem_flag")

            if not sets:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "nothing_to_update")

            args.append(tracking_number)
            await conn.execute(
                f"UPDATE parcels SET {', '.join(sets)} WHERE tracking_number = ${len(args)}",
                *args,
            )

            if new_status is not None and new_status != from_status:
                await conn.execute(
                    """
                    INSERT INTO parcel_history (tracking_number, from_status, to_status, actor_id)
                    VALUES ($1, $2, $3, $4)
                    """,
                    tracking_number, from_status, new_status, user.id,
                )

    return await get_parcel(tracking_number, request, user)
