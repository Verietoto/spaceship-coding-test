"""Login with an email and password; the session cookie says which account and for how long. Logout revokes it."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from ...core import config
from ...core.config import SECURE_COOKIES, SESSION_HOURS
from ...core.ratelimit import client_ip, limiter
from ...core.security import SessionUser, current_user, make_session, read_session, require_admin
from .repository import list_users, mark_tour, reset_all_tours, reset_tour, revoke_sessions, tour_version, verify
from .schemas import Login, TourSeen

router = APIRouter(prefix="/api", tags=["auth"])
FAIL_WINDOW = 15 * 60  # seconds that wrong passwords for one email are remembered
COOKIE = {"httponly": True, "samesite": "strict", "secure": SECURE_COOKIES}  # strict: another site's requests never carry it


@router.post("/login")
def login(body: Login, request: Request, response: Response) -> dict:
    email = body.email.strip().lower()
    limiter.hit(f"login-ip:{client_ip(request)}", config.LOGIN_IP_PER_MINUTE, 60)
    limiter.blocked(f"login-fail:{email}", config.LOGIN_MAX_FAILURES, FAIL_WINDOW)  # locked: even the right password waits
    user = verify(body.email, body.password)
    if user is None:
        limiter.add(f"login-fail:{email}", FAIL_WINDOW)
        raise HTTPException(401, "wrong email or password")
    limiter.clear(f"login-fail:{email}")
    response.set_cookie("session", make_session(user.id, user.session_version), max_age=SESSION_HOURS * 3600, **COOKIE)
    return {"email": user.email, "role": user.role}


@router.get("/me")
def me(user: SessionUser = Depends(current_user)) -> dict:
    return {"email": user.email, "role": user.role, "tour_version": tour_version(user.id)}


@router.post("/me/tour")
def finish_tour(body: TourSeen, user: SessionUser = Depends(current_user)) -> dict:
    return {"tour_version": mark_tour(user.id, body.version)}


@router.get("/admin/users", dependencies=[Depends(require_admin)])
def users() -> list[dict]:
    return list_users()


@router.post("/admin/users/{user_id}/tour/reset", dependencies=[Depends(require_admin)])
def reset_user_tour(user_id: int) -> dict:
    if not reset_tour(user_id):
        raise HTTPException(404, "no such account")
    return {"reset": 1}


@router.post("/admin/tour/reset", dependencies=[Depends(require_admin)])
def reset_every_tour() -> dict:
    return {"reset": reset_all_tours()}


@router.post("/logout")
def logout(request: Request, response: Response) -> dict:
    parsed = read_session(request.cookies.get("session", ""))
    if parsed:  # not just forget the cookie: the token itself stops working, on every device
        revoke_sessions(parsed[0])
    response.delete_cookie("session", **COOKIE)
    return {}
