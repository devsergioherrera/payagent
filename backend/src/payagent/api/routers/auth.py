from fastapi import APIRouter, HTTPException, Response

from payagent.api.deps import COOKIE, SESSION_SECONDS, make_session, password_ok
from payagent.api.schemas import LoginRequest
from payagent.config import settings

router = APIRouter(prefix="/auth")


@router.post("/login", status_code=204)
def login(body: LoginRequest, response: Response) -> None:
    if not password_ok(body.password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    response.set_cookie(
        COOKIE, make_session(), max_age=SESSION_SECONDS, httponly=True, samesite="lax", secure=bool(settings.domain)
    )


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE)
