"""Rate limits: login lockout, per-user AI budget and concurrency, dashboard saves, and the Limiter itself."""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import config
from app.core.ratelimit import Limiter
from app.main import app

BAD = {"email": "admin@test.local", "password": "wrong"}
GOOD = {"email": "admin@test.local", "password": "admin-test-pw"}


def test_window_slides() -> None:
    lim = Limiter()
    lim.hit("k", 2, 10, now=0)
    lim.hit("k", 2, 10, now=1)
    with pytest.raises(HTTPException) as e:
        lim.hit("k", 2, 10, now=2)
    assert e.value.status_code == 429 and e.value.headers["Retry-After"] == "9"
    lim.hit("k", 2, 10, now=10.5)  # the first hit left the window


def test_slots_are_capped_and_expire() -> None:
    lim = Limiter()
    lim.acquire("u", 1, now=0)
    with pytest.raises(HTTPException):
        lim.acquire("u", 1, now=1)
    lim.acquire("u", 1, now=1000)  # the first was never released: it frees itself
    lim.release("u")
    lim.acquire("u", 1, now=1001)


def test_wrong_passwords_lock_the_email_even_for_the_right_one() -> None:
    c = TestClient(app)
    for _ in range(config.LOGIN_MAX_FAILURES):
        assert c.post("/api/login", json=BAD).status_code == 401
    locked = c.post("/api/login", json=GOOD)
    assert locked.status_code == 429 and "Retry-After" in locked.headers
    other = c.post("/api/login", json={"email": "visitor@test.local", "password": "visitor-test-pw"})
    assert other.status_code == 200  # only that email is locked


def test_a_good_login_forgets_earlier_failures() -> None:
    c = TestClient(app)
    for _ in range(config.LOGIN_MAX_FAILURES - 1):
        c.post("/api/login", json=BAD)
    assert c.post("/api/login", json=GOOD).status_code == 200
    assert c.post("/api/login", json=BAD).status_code == 401  # counter restarted, not locked


def test_login_per_ip_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "LOGIN_IP_PER_MINUTE", 3)
    c = TestClient(app)
    codes = [c.post("/api/login", json={"email": f"x{i}@test.local", "password": "p"}).status_code for i in range(4)]
    assert codes == [401, 401, 401, 429]


def test_ai_budget_is_per_user(client: TestClient, visitor: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "AI_PER_MINUTE", 2)
    body = {"facts": "x", "lang": "en"}
    monkeypatch.setattr("app.modules.ai.reports.explain", lambda facts, lang: "ok")
    assert [client.post("/api/explain", json=body).status_code for _ in range(3)] == [200, 200, 429]
    assert visitor.post("/api/explain", json=body).status_code == 200  # the visitor has their own budget


def test_ai_concurrency_slot_is_released(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.ratelimit import limiter

    monkeypatch.setattr(config, "AI_CONCURRENT", 1)
    monkeypatch.setattr("app.modules.ai.reports.explain", lambda facts, lang: "ok")
    body = {"facts": "x", "lang": "en"}
    assert client.post("/api/explain", json=body).status_code == 200
    assert client.post("/api/explain", json=body).status_code == 200  # the first one gave its slot back
    me = client.get("/api/me").json()["email"]
    assert me and not any(limiter._slots.values())
