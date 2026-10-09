"""Security headers, the same-origin check on writes, and the API docs being off."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

LOGIN = {"email": "admin@test.local", "password": "admin-test-pw"}


def test_headers_on_every_response() -> None:
    r = TestClient(app).get("/api/me")  # even a 401 carries them
    assert r.headers["x-frame-options"] == "DENY" and r.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]


def test_cross_origin_write_is_refused_same_origin_allowed() -> None:
    c = TestClient(app)  # Host is "testserver"
    evil = c.post("/api/login", json=LOGIN, headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403 and "content-security-policy" in evil.headers
    assert c.post("/api/login", json=LOGIN, headers={"Origin": "http://testserver"}).status_code == 200
    assert c.post("/api/login", json=LOGIN, headers={"Origin": "http://localhost:5173", "Host": "127.0.0.1:8010"}).status_code == 200  # the Vite dev proxy
    assert c.post("/api/login", json=LOGIN).status_code == 200  # no Origin (curl, tests): the cookie rules still apply


def test_reads_ignore_origin() -> None:
    assert TestClient(app).get("/api/me", headers={"Origin": "https://evil.example"}).status_code == 401


def test_docs_are_off_unless_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main

    monkeypatch.setattr(main, "ENABLE_DOCS", False)  # whatever the developer's .env says
    off = TestClient(main.create_app())
    assert off.get("/docs").status_code == 404 and off.get("/openapi.json").status_code == 404
    monkeypatch.setattr(main, "ENABLE_DOCS", True)
    assert TestClient(main.create_app()).get("/openapi.json").status_code == 200
