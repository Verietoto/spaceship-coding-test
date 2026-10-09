"""Who may change what: rows belong to the account that saved them; the admin may remove any; schedules are admin-only."""
from fastapi.testclient import TestClient

PRESET = {"name": "mine", "filters": {"carrier": ["UPS"]}}
SCHEDULE = {"frequency": "weekly", "recipients": ["ops@spaceship.test"], "contents": ["csv"], "filters": {}}


def test_visitor_cannot_delete_the_admins_preset(client: TestClient, visitor: TestClient) -> None:
    pid = client.post("/api/presets", json=PRESET).json()["id"]
    assert visitor.delete(f"/api/presets/{pid}").status_code == 404  # not theirs: looks like it isn't there
    assert len(client.get("/api/presets").json()) == 1


def test_visitor_deletes_their_own_and_admin_deletes_any(client: TestClient, visitor: TestClient) -> None:
    mine = visitor.post("/api/presets", json=PRESET).json()["id"]
    assert visitor.delete(f"/api/presets/{mine}").status_code == 200
    theirs = visitor.post("/api/presets", json=PRESET).json()["id"]
    assert client.delete(f"/api/presets/{theirs}").status_code == 200


def test_visitor_cannot_delete_the_admins_dashboard(client: TestClient, visitor: TestClient) -> None:
    body = {"title": "t", "plan": ["p"], "widgets": [{"kind": "kpi", "title": "n", "sql": "SELECT count(*) AS v FROM orders", "format": "number"}]}
    did = client.post("/api/dashboards", json=body).json()["id"]
    assert visitor.delete(f"/api/dashboards/{did}").status_code == 404
    assert client.get(f"/api/dashboards/{did}").status_code == 200
    assert client.delete(f"/api/dashboards/{did}").status_code == 200


def test_schedules_are_admin_only(client: TestClient, visitor: TestClient) -> None:
    sid = client.post("/api/schedules", json=SCHEDULE).json()["id"]
    assert visitor.get("/api/schedules").status_code == 403
    assert visitor.post("/api/schedules", json=SCHEDULE).status_code == 403
    assert visitor.delete(f"/api/schedules/{sid}").status_code == 403
    assert len(client.get("/api/schedules").json()) == 1
