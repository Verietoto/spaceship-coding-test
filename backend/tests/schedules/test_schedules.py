"""Report schedules: save, validate, list, delete."""
from fastapi.testclient import TestClient


def test_schedules(client: TestClient) -> None:
    body = {"frequency": "weekly", "recipients": ["ops@spaceship.test"], "contents": ["summary", "csv"], "filters": {"carrier": "UPS"}}
    sid = client.post("/api/schedules", json=body).json()["id"]
    [s] = client.get("/api/schedules").json()
    assert s["id"] == sid and s["filters"]["carrier"] == ["UPS"] and s["recipients"] == ["ops@spaceship.test"]
    assert client.post("/api/schedules", json={**body, "recipients": ["not-an-email"]}).status_code == 422
    assert client.post("/api/schedules", json={**body, "filters": {"carrier": "Nope"}}).status_code == 422
    assert client.delete(f"/api/schedules/{sid}").status_code == 200
    assert client.get("/api/schedules").json() == []


def test_old_saved_filters_still_read(client: TestClient) -> None:
    """A schedule saved before multi-value filters ({"period": "Q4", "carrier": "UPS"}) is returned in the current shape."""
    from app.modules.schedules import repository

    repository.save_schedule("weekly", ["ops@spaceship.test"], ["csv"], {"period": "Q4", "region": "all", "carrier": "UPS"}, None)
    [s] = client.get("/api/schedules").json()
    assert s["filters"]["carrier"] == ["UPS"] and s["filters"]["start"] == "2025-10-01" and s["filters"]["region"] == []
