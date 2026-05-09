import asyncpg
from typing import AsyncIterator

from .config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=settings.delivery_pg_dsn,
        min_size=2,
        max_size=10,
        command_timeout=30,
        max_inactive_connection_lifetime=300,
    )


async def acquire(pool: asyncpg.Pool) -> AsyncIterator[asyncpg.Connection]:
    async with pool.acquire() as conn:
        yield conn
