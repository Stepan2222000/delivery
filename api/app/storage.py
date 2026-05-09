from minio import Minio

from .config import settings


def create_minio() -> Minio:
    return Minio(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def public_url(bucket: str, key: str) -> str:
    return f"{settings.minio_public_base}/{bucket}/{key}"
