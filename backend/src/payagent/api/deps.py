import base64
import hashlib
import hmac
import time
from functools import lru_cache

from fastapi import Cookie, HTTPException

from payagent.adapters.postgres.queries import ApiQueries
from payagent.config import settings

COOKIE = "fy_session"
SESSION_SECONDS = 12 * 3600


def _sign(payload: str) -> str:
    mac = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def make_session(now: float | None = None) -> str:
    expires = str(int((now or time.time()) + SESSION_SECONDS))
    return f"{expires}.{_sign(expires)}"


def valid_session(token: str | None, now: float | None = None) -> bool:
    if not token or not settings.session_secret or "." not in token:
        return False
    expires, signature = token.split(".", 1)
    if not hmac.compare_digest(signature, _sign(expires)):
        return False
    return expires.isdigit() and int(expires) > (now or time.time())


def require_session(fy_session: str | None = Cookie(default=None)) -> None:
    if not valid_session(fy_session):
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar")


def password_ok(candidate: str) -> bool:
    if not settings.admin_password or not settings.session_secret:
        return False
    return hmac.compare_digest(candidate.encode(), settings.admin_password.encode())


# Cached so each request reuses one object; tests replace them with app.dependency_overrides.
@lru_cache
def get_queries() -> ApiQueries:
    return ApiQueries()


@lru_cache
def get_pipeline():
    from payagent.app.wiring import build_pipeline

    return build_pipeline()


@lru_cache
def get_storage():
    from payagent.app.wiring import build_storage

    return build_storage()


@lru_cache
def get_notifier():
    from payagent.app.wiring import build_notifier

    return build_notifier()


@lru_cache
def get_invoices():
    from payagent.adapters.postgres import PostgresInvoices

    return PostgresInvoices()


@lru_cache
def get_rules():
    from payagent.adapters.postgres import PostgresRules

    return PostgresRules()


@lru_cache
def get_drafter():
    from payagent.app.wiring import build_drafter

    return build_drafter()


@lru_cache
def get_proposals():
    from payagent.app.wiring import build_proposals

    return build_proposals()
