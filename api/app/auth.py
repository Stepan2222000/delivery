"""Cookie-based session auth with plaintext-password compare from env.

Two logical accounts (admin + forwarder), credentials in env. Sessions persisted in
the `sessions` table. Cookie carries only the session UUID. TTL is rolling: every
authenticated request bumps last_seen_at and pushes expires_at forward.
"""
from __future__ import annotations

import hmac
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

import asyncpg
from fastapi import Cookie, Depends, HTTPException, Request, Response, status

from .config import settings

Role = Literal["admin", "forwarder"]


def authenticate(login: str, password: str) -> tuple[str, Role] | None:
    """Return (user_id, role) on success, None on failure."""
    candidates: list[tuple[str, str, Role]] = [
        (settings.admin_login,     settings.admin_password,     "admin"),
        (settings.forwarder_login, settings.forwarder_password, "forwarder"),
    ]
    for cfg_login, cfg_password, role in candidates:
        if hmac.compare_digest(login, cfg_login) and hmac.compare_digest(password, cfg_password):
            return (cfg_login, role)
    return None


async def create_session(
    pool: asyncpg.Pool, user_id: str, request: Request
) -> tuple[UUID, datetime]:
    expires = datetime.now(tz=timezone.utc) + timedelta(days=settings.session_ttl_days)
    ua = request.headers.get("user-agent", "")[:512]
    ip = request.client.host if request.client else None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO sessions (user_id, expires_at, user_agent, ip)
            VALUES ($1, $2, $3, $4)
            RETURNING id, expires_at
            """,
            user_id, expires, ua, ip,
        )
    return row["id"], row["expires_at"]


async def revoke_session(pool: asyncpg.Pool, sid: UUID) -> None:
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM sessions WHERE id = $1", sid)


def set_cookie(response: Response, sid: UUID, expires: datetime) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=str(sid),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        expires=expires,
        path="/",
    )


def clear_cookie(response: Response) -> None:
    response.delete_cookie(settings.cookie_name, path="/")


class CurrentUser:
    __slots__ = ("id", "role", "display_name", "session_id")

    def __init__(self, *, id: str, role: Role, display_name: str, session_id: UUID):
        self.id = id
        self.role = role
        self.display_name = display_name
        self.session_id = session_id


async def get_current_user(
    request: Request,
    response: Response,
    session_cookie: str | None = Cookie(default=None, alias=None),
) -> CurrentUser:
    raw = request.cookies.get(settings.cookie_name)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no_session")
    try:
        sid = UUID(raw)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad_session")

    pool: asyncpg.Pool = request.app.state.pool
    now = datetime.now(tz=timezone.utc)
    new_expires = now + timedelta(days=settings.session_ttl_days)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE sessions
               SET last_seen_at = $2, expires_at = $3
             WHERE id = $1 AND expires_at > $2
            RETURNING user_id, expires_at
            """,
            sid, now, new_expires,
        )
        if row is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "session_expired")
        user = await conn.fetchrow(
            "SELECT id, role::text AS role, display_name FROM users WHERE id = $1",
            row["user_id"],
        )
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user_gone")

    # Slide cookie expiration forward so client matches server.
    response.set_cookie(
        key=settings.cookie_name,
        value=str(sid),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        expires=row["expires_at"],
        path="/",
    )
    return CurrentUser(
        id=user["id"], role=user["role"], display_name=user["display_name"], session_id=sid
    )


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin_only")
    return user
