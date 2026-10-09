"""The new filters on dashboards: declared by the AI, restricted to what is declared, rendered and previewed."""
import pytest
from fastapi.testclient import TestClient

from app.db.engine import query
from app.modules.analytics import filters as af
from app.modules.dashboards import service as ds

WIDGET = {"kind": "kpi", "title": "Orders", "sql": "SELECT count(*) AS n FROM orders WHERE {{WHERE}}", "format": "number"}


def sql(where: str) -> int:
    return query(f"SELECT count(*) AS n FROM orders WHERE {where}")[0]["n"]


def spec(*filters: dict) -> dict:
    return {"title": "t", "plan": ["p"], "widgets": [WIDGET], "filters": list(filters)}


# ---------- declaring

def test_every_new_key_can_be_declared_and_is_checked_against_the_data() -> None:
    good = [
        {"key": "category", "default": ["PAPER"]}, {"key": "status", "default": ["delayed", "delivered"]}, {"key": "promo", "default": ["1"]},
        {"key": "origin", "default": ["London, UK"]}, {"key": "destination"}, {"key": "sku", "default": ["CRAYON-0017"]},
        {"key": "value", "min": 10, "max": 100}, {"key": "quantity", "min": 2}, {"key": "lead", "max": 7}, {"key": "age", "min": 0},
        {"key": "arrived", "start": "2025-03-01", "end": "2025-03-31"},
    ]
    assert [x["key"] for x in ds.clean_filters(good)] == [g["key"] for g in good]
    for bad in (
        {"key": "category", "default": ["Nope"]}, {"key": "status", "default": ["lost"]}, {"key": "promo", "default": ["2"]},
        {"key": "sku", "default": ["X-1"]}, {"key": "value", "min": 50, "max": 10}, {"key": "lead", "min": "abc"},
        {"key": "arrived", "start": "2025-05-01", "end": "2025-04-01"}, {"key": "price"},
    ):
        with pytest.raises(ValueError):
            ds.clean_filters([bad])


def test_a_declared_range_keeps_only_its_bounds() -> None:
    assert ds.clean_filters([{"key": "value", "min": 10, "default": ["junk"], "start": "2025-01-01"}]) == [{"key": "value", "min": 10}]
    assert ds.clean_filters([{"key": "arrived", "start": "2025-03-01"}]) == [{"key": "arrived", "start": "2025-03-01"}]


# ---------- what a viewer sees first, and what a viewer may change

def test_defaults_become_the_starting_filters() -> None:
    declared = ds.clean_filters([{"key": "category", "default": ["PAPER"]}, {"key": "value", "min": 20}, {"key": "arrived", "start": "2025-06-01"}])
    f = ds.default_filters(declared)
    assert f.category == ("PAPER",) and f.ranges == (("value", 20.0, None),) and str(f.arrived_start) == "2025-06-01"


def test_a_viewer_can_only_use_what_the_dashboard_offers() -> None:
    declared = ds.clean_filters([{"key": "category"}, {"key": "value"}])
    asked = af.build_filters({"category": ["PAPER"], "status": ["delayed"], "value_min": 10, "lead_max": 5, "arrived_start": "2025-02-01", "carrier": ["UPS"]})
    got = ds.restrict(asked, declared)
    assert got.category == ("PAPER",) and got.ranges == (("value", 10.0, None),)  # offered: kept
    assert got.status == () and got.carrier == () and got.arrived_start is None  # not offered: dropped, and `lead` with them
    assert not [r for r in got.ranges if r[0] == "lead"]


# ---------- rendering

def test_a_dashboard_opens_on_its_own_new_defaults_and_follows_the_viewer(client: TestClient) -> None:
    body = spec({"key": "category", "default": ["PAPER"]}, {"key": "value"}, {"key": "status"})
    did = client.post("/api/dashboards", json=body).json()["id"]
    first = client.get(f"/api/dashboards/{did}").json()
    assert first["widgets"][0]["rows"] == [{"n": sql("product_category = 'PAPER'")}] and first["applied"]["category"] == ["PAPER"]
    custom = client.get(f"/api/dashboards/{did}", params={"custom": True, "status": "delayed", "value_min": 100}).json()
    assert custom["widgets"][0]["rows"] == [{"n": sql("status = 'delayed' AND order_value_usd >= 100")}]
    ignored = client.get(f"/api/dashboards/{did}", params={"custom": True, "lead_max": 3, "origin": "London, UK"}).json()  # not declared
    assert ignored["widgets"][0]["rows"] == [{"n": 400}]


def test_a_draft_previews_new_filters_before_it_is_saved(client: TestClient) -> None:
    body = spec({"key": "status", "default": ["delayed"]}, {"key": "quantity"}, {"key": "arrived"})
    d = client.post("/api/dashboards/preview", json=body).json()
    assert d["widgets"][0]["rows"] == [{"n": sql("status = 'delayed'")}]
    custom = client.post("/api/dashboards/preview", json={**body, "values": {"arrived_start": "2025-06-01", "ranges": {"quantity": [5, None]}}}).json()
    assert custom["widgets"][0]["rows"] == [{"n": sql("quantity >= 5 AND delivery_date >= DATE '2025-06-01'")}]
    assert custom["applied"]["ranges"] == {"quantity": [5.0, None]} and custom["applied"]["status"] == []  # the draft's default status is not kept: the viewer cleared it
    assert client.get("/api/dashboards").json() == []
    assert client.post("/api/dashboards/preview", json={**body, "values": {"status": ["lost"]}}).status_code == 422


def test_the_api_takes_the_new_filter_specs(client: TestClient) -> None:
    ok = spec({"key": "sku", "default": []}, {"key": "lead", "max": 7}, {"key": "arrived", "start": "2025-03-01"})
    assert client.post("/api/dashboards", json=ok).status_code == 200
    assert client.post("/api/dashboards", json=spec({"key": "price"})).status_code == 422
    assert client.post("/api/dashboards", json=spec({"key": "status", "default": ["lost"]})).status_code == 422
