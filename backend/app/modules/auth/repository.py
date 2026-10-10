"""Users and password hashes (scrypt from the standard library)."""
import hashlib
import hmac
import os
from functools import cache

from sqlalchemy import select, update

from ...core import config
from ...core.security import SessionUser
from ...db.engine import SessionLocal
from .models import User


MIN_PASSWORD = 10
LEGACY = (2**14, 8, 1)  # the cost of "salt$digest" hashes, from before the parameters were stored with the hash


def _cost() -> tuple[int, int, int]:
    return 2**config.SCRYPT_LOG_N, 8, 3  # N=2^15, r=8, p=3: the OWASP minimum for scrypt


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> str:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=256 * n * r).hex()


def hash_password(password: str) -> str:
    """`n$r$p$salt$digest`: the cost is stored with the hash, so it can be raised later without locking anyone out."""
    n, r, p = _cost()
    salt = os.urandom(16)
    return f"{n}${r}${p}${salt.hex()}${_scrypt(password, salt, n, r, p)}"


def _parse(stored: str) -> tuple[tuple[int, int, int], str, str]:
    parts = stored.split("$")
    if len(parts) == 2:
        return LEGACY, parts[0], parts[1]
    n, r, p, salt, digest = parts
    return (int(n), int(r), int(p)), salt, digest


def check_password(password: str, stored: str) -> bool:
    (n, r, p), salt, digest = _parse(stored)
    return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt), n, r, p), digest)


def needs_upgrade(stored: str) -> bool:
    return _parse(stored)[0] != _cost()


@cache
def _dummy() -> str:
    return hash_password("no-such-account")


def verify(email: str, password: str) -> User | None:
    """The account when email and password match. An unknown email still costs one full hash, so the response time
    does not tell which emails exist. A correct login on an older hash re-saves it at the current cost."""
    email = email.strip().lower()
    with SessionLocal() as s:
        user = s.scalar(select(User).where(User.email == email))
    if user is None:
        check_password(password, _dummy())
        return None
    if not check_password(password, user.password_hash):
        return None
    if needs_upgrade(user.password_hash):
        with SessionLocal.begin() as s:
            s.execute(update(User).where(User.id == user.id).values(password_hash=hash_password(password)))
    return user


def upsert_user(email: str, password: str, role: str) -> None:
    if len(password) < MIN_PASSWORD:
        raise ValueError(f"password must be at least {MIN_PASSWORD} characters")
    email = email.strip().lower()
    with SessionLocal.begin() as s:
        user = s.scalar(select(User).where(User.email == email))
        if user:
            user.password_hash, user.role = hash_password(password), role
        else:
            s.add(User(email=email, password_hash=hash_password(password), role=role))


def session_user(user_id: int) -> tuple[SessionUser, int] | None:
    """The account as it is now (role included) with its session version; None when it no longer exists."""
    with SessionLocal() as s:
        u = s.get(User, user_id)
    return (SessionUser(u.id, u.email, u.role), u.session_version) if u else None


def revoke_sessions(user_id: int) -> None:
    """Every token issued so far for this account stops working."""
    with SessionLocal.begin() as s:
        u = s.get(User, user_id)
        if u:
            u.session_version += 1



# ---------- the onboarding tour: shown once per account, an admin can reset it

def tour_version(user_id: int) -> int:
    with SessionLocal() as s:
        u = s.get(User, user_id)
    return u.tour_version if u else 0


def mark_tour(user_id: int, version: int) -> int:
    """The account finished (or skipped) this tour version. It only ever goes up, so an old page cannot bring the tour back."""
    with SessionLocal.begin() as s:
        u = s.get(User, user_id)
        if u is None:
            return 0
        u.tour_version = max(u.tour_version, version)
        return u.tour_version


def list_users() -> list[dict]:
    with SessionLocal() as s:
        rows = s.scalars(select(User).order_by(User.email)).all()
    return [{"id": u.id, "email": u.email, "role": u.role, "tour_version": u.tour_version, "created_at": u.created_at.isoformat()} for u in rows]


def reset_tour(user_id: int) -> bool:
    """The account sees the whole tour again on its next page load. False when there is no such account."""
    with SessionLocal.begin() as s:
        u = s.get(User, user_id)
        if u is None:
            return False
        u.tour_version = 0
        return True


def reset_all_tours() -> int:
    with SessionLocal.begin() as s:
        return s.execute(update(User).values(tour_version=0)).rowcount
