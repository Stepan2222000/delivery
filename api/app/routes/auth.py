from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

from ..auth import (
    CurrentUser,
    authenticate,
    clear_cookie,
    create_session,
    get_current_user,
    revoke_session,
    set_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    login: str
    password: str


class MeOut(BaseModel):
    id: str
    role: str
    display_name: str


@router.post("/login", response_model=MeOut)
async def login(body: LoginIn, request: Request, response: Response):
    matched = authenticate(body.login, body.password)
    if matched is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad_credentials")
    user_id, role = matched
    sid, expires = await create_session(request.app.state.pool, user_id, request)
    set_cookie(response, sid, expires)
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, role::text AS role, display_name FROM users WHERE id = $1", user_id
        )
    return MeOut(**dict(row))


@router.post("/logout")
async def logout(
    request: Request, response: Response, user: CurrentUser = Depends(get_current_user)
):
    await revoke_session(request.app.state.pool, user.session_id)
    clear_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser = Depends(get_current_user)):
    return MeOut(id=user.id, role=user.role, display_name=user.display_name)
