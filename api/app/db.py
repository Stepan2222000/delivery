import json

import asyncpg

from .config import settings


async def _register_jsonb(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
    )


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=settings.delivery_pg_dsn,
        min_size=2,
        max_size=10,
        command_timeout=30,
        max_inactive_connection_lifetime=300,
        init=_register_jsonb,
    )


async def create_agent_pool() -> asyncpg.Pool:
    """Pool for the delivery_agent DB (lookup requests + AI chat)."""
    return await asyncpg.create_pool(
        dsn=settings.delivery_agent_pg_dsn,
        min_size=1,
        max_size=5,
        command_timeout=30,
        max_inactive_connection_lifetime=300,
        init=_register_jsonb,
    )


async def create_ebay_pool() -> asyncpg.Pool:
    """Pool for direct writes to ebay_orders (delivery_extra_tracks).
    Reads still go through FDW; this is only for the link operation.
    """
    return await asyncpg.create_pool(
        dsn=settings.ebay_orders_pg_dsn,
        min_size=1,
        max_size=3,
        command_timeout=30,
        max_inactive_connection_lifetime=300,
        init=_register_jsonb,
    )
