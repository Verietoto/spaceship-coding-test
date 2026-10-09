"""Sessions: a signed cookie that names an account, the version of its sessions, and when it stops being valid.

Who the user is, and their role, come from the database on every request: an account that was removed or demoted loses
access at once. Logging out raises the account's session version, which revokes every token it issued before.
"""
import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from .config import SESSION_HOURS, SESSION_SECRET

MIN_SECRET = 32


def require_session_secret() -> None:
    """Called at startup: a missing, short or placeholder secret would let anyone forge an admin session."""
    if len(SESSION_SECRET) < MIN_SECRET or SESSION_SECRET.lower().startswith("change-me"):
        raise RuntimeError(
            "SESSION_SECRET must be a random string of at least 32 characters (not a placeholder). "
            'Generate one: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )


@dataclass(frozen=True)
class SessionUser:
    id: int
    email: str
    role: str


def _sign(payload: str) -> str:
    return hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_session(user_id: int, version: int, now: float | None = None) -> str:
    exp = int((time.time() if now is None else now) + SESSION_HOURS * 3600)
    payload = base64.urlsafe_b64encode(json.dumps([user_id, version, exp]).encode()).decode()
    return f"{payload}.{_sign(payload)}"


def read_session(token: str, now: float | None = None) -> tuple[int, int] | None:
    """(user id, session version) of a genuine, unexpired token; None otherwise."""
    payload, _, sig = token.rpartition(".")
    if not payload or not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        user_id, version, exp = json.loads(base64.urlsafe_b64decode(payload))
        if int(exp) <= (time.time() if now is None else now):
            return None
        return int(user_id), int(version)
    except (ValueError, TypeError):
        return None


UserLoader = Callable[[int], tuple[SessionUser, int] | None]  # user id -> (the user as the database has it now, its session version)
_load_user: UserLoader | None = None


def set_user_loader(loader: UserLoader) -> None:
    """Wired in main.py: this module sits below the database layer, so it is handed the lookup instead of importing it."""
    global _load_user
    _load_user = loader


def current_user(request: Request) -> SessionUser:
    parsed = read_session(request.cookies.get("session", ""))
    found = _load_user(parsed[0]) if parsed and _load_user else None
    if found is None or found[1] != parsed[1]:  # type: ignore[index]  (found is None covers parsed is None)
        raise HTTPException(401, "login required")
    return found[0]


def require_admin(user: SessionUser = Depends(current_user)) -> SessionUser:
    if user.role != "admin":
        raise HTTPException(403, "admin only")
    return user


logged_in = Depends(current_user)  # router-level: every endpoint needs a session
