"""Login with email + password. The session is signed, expires, and carries only an account id and a version: who the user is
and their role come from the database on every request, and logging out revokes the token itself."""
import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core import security
from app.core.security import make_session, read_session
from app.db.engine import engine
from app.main import app
from app.modules.auth import repository
from app.modules.auth.repository import check_password, hash_password

ADMIN = {"email": "admin@test.local", "password": "admin-test-pw"}


def identity(email: str) -> tuple[int, int]:
    with engine.connect() as con:
        return tuple(con.execute(text("SELECT id, session_version FROM users WHERE email = :e"), {"e": email}).one())  # type: ignore[return-value]


def forged(payload: list, secret: bytes) -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{body}.{hmac.new(secret, body.encode(), hashlib.sha256).hexdigest()}"


def test_requires_login() -> None:
    c = TestClient(app)
    assert c.get("/api/dashboards").status_code == 401
    assert c.post("/api/copilot", json={"message": "hi"}).status_code == 401
    assert c.get("/api/me").status_code == 401


def test_wrong_credentials() -> None:
    c = TestClient(app)
    assert c.post("/api/login", json={**ADMIN, "password": "nope"}).status_code == 401
    assert c.post("/api/login", json={"email": "nobody@test.local", "password": ADMIN["password"]}).status_code == 401


def test_roles(client: TestClient, visitor: TestClient) -> None:
    assert client.get("/api/me").json() == {"email": "admin@test.local", "role": "admin"}
    assert visitor.get("/api/me").json() == {"email": "visitor@test.local", "role": "visitor"}
    assert visitor.get("/api/dashboards").status_code == 200


def test_login_ignores_email_case() -> None:
    assert TestClient(app).post("/api/login", json={**ADMIN, "email": " Admin@Test.Local "}).status_code == 200


def test_the_cookie_is_httponly_strict_and_expires() -> None:
    cookie = TestClient(app).post("/api/login", json=ADMIN).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and f"max-age={security.SESSION_HOURS * 3600}" in cookie


def test_tampered_or_forged_sessions_are_rejected() -> None:
    uid, version = identity(ADMIN["email"])
    token = make_session(uid, version)
    assert read_session(token) == (uid, version)
    payload, sig = token.rsplit(".", 1)
    assert read_session(f"{payload}.{'0' * len(sig)}") is None and read_session("garbage") is None
    assert TestClient(app, cookies={"session": token + "x"}).get("/api/me").status_code == 401
    # the old public default secret, in the old and the new token format, forges nothing
    assert TestClient(app, cookies={"session": forged([uid, "attacker@evil.co", "admin"], b"dev-only-secret")}).get("/api/me").status_code == 401
    assert TestClient(app, cookies={"session": forged([uid, version, int(time.time()) + 3600], b"dev-only-secret")}).get("/api/me").status_code == 401


def test_an_expired_token_is_rejected() -> None:
    uid, version = identity(ADMIN["email"])
    old = make_session(uid, version, now=time.time() - (security.SESSION_HOURS + 1) * 3600)
    assert read_session(old) is None
    assert TestClient(app, cookies={"session": old}).get("/api/me").status_code == 401
    assert TestClient(app, cookies={"session": make_session(uid, version)}).get("/api/me").status_code == 200


def test_logout_revokes_the_token_itself_not_just_the_cookie() -> None:
    c = TestClient(app)
    assert c.post("/api/login", json=ADMIN).status_code == 200
    token = c.cookies["session"]
    assert TestClient(app, cookies={"session": token}).get("/api/me").status_code == 200
    c.post("/api/logout")
    assert TestClient(app, cookies={"session": token}).get("/api/me").status_code == 401  # a copied cookie is dead too
    assert c.post("/api/login", json=ADMIN).status_code == 200 and c.get("/api/me").status_code == 200  # a new login works


def test_the_role_comes_from_the_database_not_the_cookie(client: TestClient) -> None:
    assert client.get("/api/me").json()["role"] == "admin"
    with engine.begin() as con:
        con.execute(text("UPDATE users SET role = 'visitor' WHERE email = 'admin@test.local'"))
    try:
        assert client.get("/api/me").json()["role"] == "visitor"  # demoted: the same cookie no longer opens admin doors
        assert client.post("/api/knowledge/docs", json={"title": "x", "body": "y"}).status_code == 403
    finally:
        with engine.begin() as con:
            con.execute(text("UPDATE users SET role = 'admin' WHERE email = 'admin@test.local'"))


def test_a_removed_account_loses_access_at_once() -> None:
    repository.upsert_user("gone@test.local", "a-long-enough-password", "visitor")
    c = TestClient(app)
    assert c.post("/api/login", json={"email": "gone@test.local", "password": "a-long-enough-password"}).status_code == 200
    assert c.get("/api/me").status_code == 200
    with engine.begin() as con:
        con.execute(text("DELETE FROM users WHERE email = 'gone@test.local'"))
    assert c.get("/api/me").status_code == 401


@pytest.mark.parametrize("secret", ["", "short", "change-me-to-a-long-random-string-0123456789", "CHANGE-ME-" + "x" * 40])
def test_the_app_refuses_a_weak_session_secret(monkeypatch: pytest.MonkeyPatch, secret: str) -> None:
    monkeypatch.setattr(security, "SESSION_SECRET", secret)
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        security.require_session_secret()


def test_a_real_session_secret_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "SESSION_SECRET", "k" * 32)
    security.require_session_secret()


def test_password_hash() -> None:
    h = hash_password("secret")
    assert "secret" not in h and check_password("secret", h) and not check_password("other", h)


def test_hash_stores_its_cost_and_old_hashes_still_verify_then_upgrade() -> None:
    import hashlib
    import os

    stored = hash_password("a-long-enough-password")
    assert stored.count("$") == 4 and not repository.needs_upgrade(stored)
    salt = os.urandom(16)
    legacy = f"{salt.hex()}${hashlib.scrypt(b'a-long-enough-password', salt=salt, n=2**14, r=8, p=1).hex()}"  # the old format
    assert check_password("a-long-enough-password", legacy) and not check_password("nope", legacy)
    assert repository.needs_upgrade(legacy)
    with engine.begin() as con:
        con.execute(text("UPDATE users SET password_hash = :h WHERE email = 'admin@test.local'"), {"h": legacy.replace(legacy.split("$")[1], hashlib.scrypt(b"admin-test-pw", salt=salt, n=2**14, r=8, p=1).hex())})
    assert repository.verify("admin@test.local", "admin-test-pw") is not None
    with engine.connect() as con:
        assert not repository.needs_upgrade(con.execute(text("SELECT password_hash FROM users WHERE email = 'admin@test.local'")).scalar_one())


def test_short_passwords_are_refused_and_unknown_emails_cost_a_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError):
        repository.upsert_user("x@test.local", "short", "visitor")
    calls: list[str] = []
    real = repository.check_password
    monkeypatch.setattr(repository, "check_password", lambda p, s: calls.append(s) or real(p, s))
    assert repository.verify("nobody@test.local", "whatever-password") is None
    assert len(calls) == 1  # the dummy hash was checked, so timing does not reveal that the email is unknown
