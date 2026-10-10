"""The onboarding tour is shown once per account (the server remembers it); an admin can reset it for one account or all."""
import pytest
from collections.abc import Iterator
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.engine import engine
from app.main import app


@pytest.fixture(autouse=True)
def fresh_tours() -> Iterator[None]:
    """No test leaves a tour status behind for the next one (the accounts live for the whole session)."""
    yield
    with engine.begin() as con:
        con.execute(text("UPDATE users SET tour_version = 0"))


def set_tour(email: str, version: int) -> None:
    with engine.begin() as con:
        con.execute(text("UPDATE users SET tour_version = :v WHERE email = :e"), {"v": version, "e": email})


def user_id(email: str) -> int:
    with engine.connect() as con:
        return con.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).scalar_one()


def test_a_new_account_has_not_seen_the_tour(client: TestClient) -> None:
    set_tour("admin@test.local", 0)
    assert client.get("/api/me").json()["tour_version"] == 0


def test_finishing_the_tour_is_remembered_and_only_goes_up(visitor: TestClient) -> None:
    set_tour("visitor@test.local", 0)
    assert visitor.post("/api/me/tour", json={"version": 2}).json() == {"tour_version": 2}
    assert visitor.get("/api/me").json()["tour_version"] == 2
    assert visitor.post("/api/me/tour", json={"version": 1}).json() == {"tour_version": 2}  # an old page cannot bring it back
    assert visitor.get("/api/me").json()["tour_version"] == 2


def test_the_version_must_be_sensible(visitor: TestClient) -> None:
    for bad in (0, -1, 100, "x", None):
        assert visitor.post("/api/me/tour", json={"version": bad}).status_code == 422


def test_the_tour_needs_a_login() -> None:
    c = TestClient(app)
    assert c.post("/api/me/tour", json={"version": 1}).status_code == 401
    assert c.get("/api/admin/users").status_code == 401
    assert c.post("/api/admin/tour/reset").status_code == 401


def test_a_visitor_cannot_touch_the_admin_endpoints(visitor: TestClient) -> None:
    assert visitor.get("/api/admin/users").status_code == 403
    assert visitor.post(f"/api/admin/users/{user_id('visitor@test.local')}/tour/reset").status_code == 403
    assert visitor.post("/api/admin/tour/reset").status_code == 403


def test_the_admin_lists_accounts_with_their_tour_status(client: TestClient) -> None:
    set_tour("admin@test.local", 1)
    set_tour("visitor@test.local", 0)
    rows = {u["email"]: u for u in client.get("/api/admin/users").json()}
    assert {"admin@test.local", "visitor@test.local"} <= set(rows)
    assert rows["admin@test.local"]["tour_version"] == 1 and rows["visitor@test.local"]["tour_version"] == 0
    assert rows["admin@test.local"]["role"] == "admin" and "password_hash" not in rows["admin@test.local"]  # never leaked


def test_the_admin_resets_one_account_and_leaves_the_others(client: TestClient, visitor: TestClient) -> None:
    set_tour("admin@test.local", 3)
    set_tour("visitor@test.local", 3)
    assert client.post(f"/api/admin/users/{user_id('visitor@test.local')}/tour/reset").json() == {"reset": 1}
    assert visitor.get("/api/me").json()["tour_version"] == 0
    assert client.get("/api/me").json()["tour_version"] == 3


def test_resetting_an_unknown_account_is_a_404(client: TestClient) -> None:
    assert client.post("/api/admin/users/999999/tour/reset").status_code == 404


def test_the_admin_resets_every_account(client: TestClient, visitor: TestClient) -> None:
    set_tour("admin@test.local", 2)
    set_tour("visitor@test.local", 2)
    assert client.post("/api/admin/tour/reset").json()["reset"] >= 2
    assert client.get("/api/me").json()["tour_version"] == 0 and visitor.get("/api/me").json()["tour_version"] == 0
