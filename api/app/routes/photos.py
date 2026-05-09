"""Photo upload to MinIO. Two buckets:
- parcel photos → parts-photos with prefix `delivery/parcels/{tn}/`
- waybills     → delivery-photos with prefix `waybills/{shipment_id}/`
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter, Depends, File, HTTPException, Request, UploadFile, status,
)

from ..auth import CurrentUser, get_current_user
from ..config import settings
from ..storage import public_url

router = APIRouter(tags=["photos"])

MAX_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_PHOTOS_PER_PARCEL = 10
MAX_WAYBILLS_PER_SHIPMENT = 5
PHOTO_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}
WAYBILL_TYPES = {**PHOTO_TYPES, "application/pdf": "pdf"}


def _slug(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).stem)
    return s[:60] or "file"


def _validate_upload(file: UploadFile, allowed: dict[str, str]) -> tuple[str, bytes]:
    if file.content_type not in allowed:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"bad_type:{file.content_type}")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large")
    return allowed[file.content_type], data


@router.post("/parcels/{tracking_number}/photos")
async def upload_parcel_photo(
    tracking_number: str,
    request: Request,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    pool = request.app.state.pool
    minio = request.app.state.minio
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM parcels WHERE tracking_number = $1", tracking_number
        )
        if not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "parcel_not_found")
        cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM parcel_photos WHERE tracking_number = $1", tracking_number
        )
        if int(cnt) >= MAX_PHOTOS_PER_PARCEL:
            raise HTTPException(status.HTTP_409_CONFLICT, "too_many_photos")

    ext, data = _validate_upload(file, PHOTO_TYPES)
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
    key = f"{settings.minio_photo_prefix}/{tracking_number}/{ts}-{_slug(file.filename or 'file')}.{ext}"
    bucket = settings.minio_bucket_photos
    minio.put_object(
        bucket, key, io.BytesIO(data), length=len(data), content_type=file.content_type,
    )
    url = public_url(bucket, key)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO parcel_photos (tracking_number, object_key, public_url, mime_type, bytes, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, public_url, uploaded_at
            """,
            tracking_number, key, url, file.content_type, len(data), user.id,
        )
    return {"id": row["id"], "public_url": row["public_url"], "uploaded_at": row["uploaded_at"]}


@router.post("/shipments/{sid}/waybill")
async def upload_waybill(
    sid: str,
    request: Request,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    pool = request.app.state.pool
    minio = request.app.state.minio
    async with pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM shipments WHERE id = $1", sid)
        if not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "shipment_not_found")
        cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM shipment_waybills WHERE shipment_id = $1", sid
        )
        if int(cnt) >= MAX_WAYBILLS_PER_SHIPMENT:
            raise HTTPException(status.HTTP_409_CONFLICT, "too_many_waybills")

    ext, data = _validate_upload(file, WAYBILL_TYPES)
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
    key = f"waybills/{sid}/{ts}-{_slug(file.filename or 'file')}.{ext}"
    bucket = settings.minio_bucket_waybills
    minio.put_object(
        bucket, key, io.BytesIO(data), length=len(data), content_type=file.content_type,
    )
    url = public_url(bucket, key)

    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO shipment_waybills (shipment_id, object_key, public_url, mime_type, bytes, uploaded_by)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, public_url, uploaded_at
                """,
                sid, key, url, file.content_type, len(data), user.id,
            )
            # Mirror first waybill onto shipments.waybill_photo_url for quick display.
            await conn.execute(
                "UPDATE shipments SET waybill_photo_url = COALESCE(waybill_photo_url, $1) WHERE id = $2",
                url, sid,
            )
    return {"id": row["id"], "public_url": row["public_url"], "uploaded_at": row["uploaded_at"]}
