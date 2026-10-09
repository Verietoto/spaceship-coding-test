"""Saved filter views."""
from fastapi.testclient import TestClient


def test_save_list_delete(client: TestClient) -> None:
    body = {"name": "Q4 UPS+FedEx", "filters": {"period": "Q4", "carrier": ["UPS", "FedEx"]}, "compare": "base"}
    pid = client.post("/api/presets", json=body).json()["id"]
    [p] = client.get("/api/presets").json()
    assert p["id"] == pid and p["name"] == "Q4 UPS+FedEx"
    assert p["filters"]["carrier"] == ["FedEx", "UPS"] and p["filters"]["start"] == "2025-10-01" and p["filters"]["compare"] == "base"
    assert client.delete(f"/api/presets/{pid}").status_code == 200
    assert client.delete(f"/api/presets/{pid}").status_code == 404
    assert client.get("/api/presets").json() == []


def test_rejects_bad_values_and_names(client: TestClient) -> None:
    assert client.post("/api/presets", json={"name": "x", "filters": {"carrier": ["Nope"]}}).status_code == 422
    assert client.post("/api/presets", json={"name": "", "filters": {}}).status_code == 422
    assert client.post("/api/presets", json={"name": "x" * 61, "filters": {}}).status_code == 422


def test_requires_login() -> None:
    from app.main import app

    assert TestClient(app).get("/api/presets").status_code == 401
