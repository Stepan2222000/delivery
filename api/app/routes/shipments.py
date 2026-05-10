from __future__ import annotations

from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..auth import CurrentUser, get_current_user, require_admin
from ..schemas import (
    ShipmentAddRemoveTrack,
    ShipmentCreate,
    ShipmentOut,
    ShipmentPatch,
    ShipmentReceiveBody,
)

router = APIRouter(prefix="/shipments", tags=["shipments"])


SHIPMENT_COLS = """
    s.id, s.direction, s.status, s.transport, s.waybill_no, s.notes,
    s.waybill_photo_url, s.planned_sent_at, s.planned_arrival_at,
    s.sent_at, s.arrived_at, s.created_at,
    COALESCE(
        (SELECT array_agg(p.tracking_number ORDER BY p.ordered_at)
           FROM parcels p
          WHERE p.shipment_kg_to_ru_id = s.id OR p.shipment_usa_to_kg_id = s.id),
        ARRAY[]::text[]
    ) AS tracking_numbers
"""


def _row_to_shipment(row: asyncpg.Record) -> ShipmentOut:
    return ShipmentOut(
        id=row["id"],
        direction=row["direction"],
        status=row["status"],
        transport=row["transport"],
        waybill_no=row["waybill_no"],
        notes=row["notes"],
        waybill_photo_url=row["waybill_photo_url"],
        planned_sent_at=row["planned_sent_at"],
        planned_arrival_at=row["planned_arrival_at"],
        sent_at=row["sent_at"],
        arrived_at=row["arrived_at"],
        created_at=row["created_at"],
        tracking_numbers=list(row["tracking_numbers"]),
    )


def _next_id(existing_count: int) -> str:
    return f"sh_{existing_count + 1:03d}"


@router.get("", response_model=list[ShipmentOut])
async def list_shipments(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    status_filter: str | None = None,
):
    pool: asyncpg.Pool = request.app.state.pool
    where = ""
    args: list = []
    if status_filter:
        args.append(status_filter)
        where = "WHERE s.status = $1::shipment_status"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT {SHIPMENT_COLS} FROM shipments s {where} ORDER BY s.created_at DESC",
            *args,
        )
    return [_row_to_shipment(r) for r in rows]


@router.get("/{sid}", response_model=ShipmentOut)
async def get_shipment(
    sid: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(f"SELECT {SHIPMENT_COLS} FROM shipments s WHERE s.id = $1", sid)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
    return _row_to_shipment(row)


@router.post("", response_model=ShipmentOut, status_code=status.HTTP_201_CREATED)
async def create_shipment(
    body: ShipmentCreate,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM shipments")
        sid = _next_id(int(count))
        await conn.execute(
            """
            INSERT INTO shipments
                (id, direction, status, transport, waybill_no, notes,
                 planned_sent_at, planned_arrival_at, created_by)
            VALUES ($1, $2::shipment_direction, 'draft', $3, $4, $5, $6, $7, $8)
            """,
            sid, body.direction, body.transport, body.waybill_no, body.notes,
            body.planned_sent_at, body.planned_arrival_at, user.id,
        )
    return await get_shipment(sid, request, user)


@router.patch("/{sid}", response_model=ShipmentOut)
async def patch_shipment(
    sid: str,
    body: ShipmentPatch,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    pool: asyncpg.Pool = request.app.state.pool
    sets: list[str] = []
    args: list = []
    for field in ("transport", "waybill_no", "notes", "planned_sent_at", "planned_arrival_at"):
        v = getattr(body, field)
        if v is not None:
            args.append(v)
            sets.append(f"{field} = ${len(args)}")
    if not sets:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "nothing_to_update")
    args.append(sid)
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"UPDATE shipments SET {', '.join(sets)} WHERE id = ${len(args)} AND status = 'draft'",
            *args,
        )
        if result.endswith(" 0"):
            raise HTTPException(status.HTTP_409_CONFLICT, "not_draft_or_not_found")
    return await get_shipment(sid, request, user)


@router.post("/{sid}/parcels", response_model=ShipmentOut)
async def add_parcel(
    sid: str,
    body: ShipmentAddRemoveTrack,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            sh = await conn.fetchrow(
                "SELECT direction, status FROM shipments WHERE id = $1 FOR UPDATE", sid
            )
            if sh is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
            if sh["status"] != "draft":
                raise HTTPException(status.HTTP_409_CONFLICT, "not_draft")
            parcel = await conn.fetchrow(
                "SELECT status, shipment_kg_to_ru_id, shipment_usa_to_kg_id FROM parcels WHERE tracking_number = $1 FOR UPDATE",
                body.tracking_number,
            )
            if parcel is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "parcel_not_found")
            col = "shipment_kg_to_ru_id" if sh["direction"] == "kg_to_ru" else "shipment_usa_to_kg_id"
            if parcel[col] is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, "parcel_already_in_shipment")
            # Only `arrived_kg` parcels are eligible for KG→RU shipments.
            if sh["direction"] == "kg_to_ru" and parcel["status"] != "arrived_kg":
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"parcel_must_be_in_kg:got_{parcel['status']}",
                )
            await conn.execute(
                f"UPDATE parcels SET {col} = $2 WHERE tracking_number = $1",
                body.tracking_number, sid,
            )
    return await get_shipment(sid, request, user)


@router.delete("/{sid}/parcels/{tn}", response_model=ShipmentOut)
async def remove_parcel(
    sid: str, tn: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            sh = await conn.fetchrow(
                "SELECT direction, status FROM shipments WHERE id = $1 FOR UPDATE", sid
            )
            if sh is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
            if sh["status"] != "draft":
                raise HTTPException(status.HTTP_409_CONFLICT, "not_draft")
            col = "shipment_kg_to_ru_id" if sh["direction"] == "kg_to_ru" else "shipment_usa_to_kg_id"
            await conn.execute(
                f"UPDATE parcels SET {col} = NULL WHERE tracking_number = $1 AND {col} = $2",
                tn, sid,
            )
    return await get_shipment(sid, request, user)


@router.delete("/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    sid: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            sh = await conn.fetchrow("SELECT direction, status FROM shipments WHERE id = $1 FOR UPDATE", sid)
            if sh is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
            if sh["status"] != "draft":
                raise HTTPException(status.HTTP_409_CONFLICT, "not_draft")
            col = "shipment_kg_to_ru_id" if sh["direction"] == "kg_to_ru" else "shipment_usa_to_kg_id"
            await conn.execute(f"UPDATE parcels SET {col} = NULL WHERE {col} = $1", sid)
            await conn.execute("DELETE FROM shipments WHERE id = $1", sid)


@router.post("/{sid}/send", response_model=ShipmentOut)
async def send_shipment(
    sid: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            sh = await conn.fetchrow(
                "SELECT direction, status FROM shipments WHERE id = $1 FOR UPDATE", sid
            )
            if sh is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
            if sh["status"] != "draft":
                raise HTTPException(status.HTTP_409_CONFLICT, "not_draft")
            tariff = await conn.fetchval("SELECT tariff_usd_per_kg FROM settings WHERE id = 1")

            col = "shipment_kg_to_ru_id" if sh["direction"] == "kg_to_ru" else "shipment_usa_to_kg_id"
            tns = await conn.fetch(
                f"SELECT tracking_number, weight_kg FROM parcels WHERE {col} = $1", sid
            )
            if not tns:
                raise HTTPException(status.HTTP_409_CONFLICT, "empty_shipment")
            if sh["direction"] == "kg_to_ru":
                missing = [r["tracking_number"] for r in tns if r["weight_kg"] is None]
                if missing:
                    raise HTTPException(status.HTTP_409_CONFLICT, f"missing_weight:{','.join(missing)}")

            now = datetime.now(tz=timezone.utc)
            new_parcel_status = "in_shipment_kg_to_ru" if sh["direction"] == "kg_to_ru" else "in_shipment_usa_to_kg"

            await conn.execute(
                "UPDATE shipments SET status = 'in_transit', sent_at = $1 WHERE id = $2",
                now, sid,
            )
            for r in tns:
                tn = r["tracking_number"]
                weight = r["weight_kg"]
                shipping_cost = float(weight) * float(tariff) if (weight is not None and sh["direction"] == "kg_to_ru") else None
                if sh["direction"] == "kg_to_ru":
                    await conn.execute(
                        """
                        UPDATE parcels
                           SET status = 'in_shipment_kg_to_ru',
                               tariff_snapshot_usd_per_kg = $2,
                               shipping_cost_usd_snapshot = $3
                         WHERE tracking_number = $1
                        """,
                        tn, tariff, shipping_cost,
                    )
                else:
                    await conn.execute(
                        "UPDATE parcels SET status = 'in_shipment_usa_to_kg' WHERE tracking_number = $1",
                        tn,
                    )
                await conn.execute(
                    """
                    INSERT INTO parcel_history (tracking_number, from_status, to_status, actor_id, note)
                    SELECT $1, NULL, $2, $3, $4
                    """,
                    tn, new_parcel_status, user.id, f"shipment {sid} sent",
                )
    return await get_shipment(sid, request, user)


@router.post("/{sid}/receive", response_model=ShipmentOut)
async def receive_shipment(
    sid: str,
    body: ShipmentReceiveBody,
    request: Request,
    user: CurrentUser = Depends(require_admin),
):
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            sh = await conn.fetchrow(
                "SELECT direction, status FROM shipments WHERE id = $1 FOR UPDATE", sid
            )
            if sh is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
            if sh["status"] != "in_transit":
                raise HTTPException(status.HTTP_409_CONFLICT, "not_in_transit")
            now = datetime.now(tz=timezone.utc)
            for item in body.items:
                target = "delivered_ru" if item.received else "not_received_ru"
                problem = None if item.received else "lost"
                await conn.execute(
                    """
                    UPDATE parcels
                       SET status = $2::parcel_status,
                           delivered_ru_at = CASE WHEN $2 = 'delivered_ru' THEN $3 ELSE delivered_ru_at END,
                           problem = COALESCE($4::problem_flag, problem)
                     WHERE tracking_number = $1
                    """,
                    item.tracking_number, target, now, problem,
                )
                await conn.execute(
                    """
                    INSERT INTO parcel_history (tracking_number, from_status, to_status, actor_id, note)
                    SELECT $1, NULL, $2::parcel_status, $3, $4
                    """,
                    item.tracking_number, target, user.id, f"shipment {sid} received",
                )
            await conn.execute(
                "UPDATE shipments SET status = 'received', arrived_at = $1 WHERE id = $2",
                now, sid,
            )
    return await get_shipment(sid, request, user)
