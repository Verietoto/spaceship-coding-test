"""Saved dashboards and the AI Builder (fake model)."""

import pytest
from fastapi.testclient import TestClient



def test_builder_draft_save_open_delete(client: TestClient, fake_model) -> None:  # noqa: ANN001
    from langchain_core.messages import AIMessage
    from tests.conftest import call

    spec = {
        "title": "SLA carrier",
        "plan": ["KPI", "Scorecard"],
        "widgets": [
            {"kind": "kpi", "title": "Delay", "sql": "SELECT avg(CASE WHEN status='delayed' THEN 100.0 ELSE 0 END) AS v FROM orders", "formulas": ["delay"], "format": "pct"},
            {"kind": "chart", "title": "P90", "sql": "SELECT carrier, percentile_cont(0.9) WITHIN GROUP (ORDER BY lead_days) AS p90 FROM orders GROUP BY 1", "formulas": [], "chart_type": "bar", "x": "carrier", "y": ["p90"]},
            {"kind": "kpi", "title": "Evil", "sql": "DROP TABLE orders", "formulas": []},
        ],
    }
    fake_model([call("create_dashboard", spec), AIMessage(content="SLA carrier")])

    draft = client.post("/api/builder", json={"prompt": "Dashboard SLA carrier bulanan"}).json()
    assert round(draft["widgets"][0]["rows"][0]["v"], 2) == 13.75
    assert len(draft["widgets"][1]["rows"]) == 9
    assert draft["widgets"][2]["error"]  # the unsafe widget is refused, the rest still renders

    good = {"title": draft["title"], "plan": draft["plan"], "widgets": [{k: v for k, v in w.items() if k not in ("rows", "error")} for w in draft["widgets"][:2]]}
    did = client.post("/api/dashboards", json=good).json()["id"]
    assert [d["title"] for d in client.get("/api/dashboards").json()] == ["SLA carrier"]
    opened = client.get(f"/api/dashboards/{did}").json()
    assert opened["widgets"][1]["rows"] and opened["plan"] == ["KPI", "Scorecard"]
    assert client.delete(f"/api/dashboards/{did}").status_code == 200
    assert client.get(f"/api/dashboards/{did}").status_code == 404


def test_a_saved_dashboard_keeps_its_highlight_and_the_limits_hold(client: TestClient) -> None:
    chart = {"kind": "chart", "title": "Orders per carrier", "sql": "SELECT carrier, count(*) AS n FROM orders GROUP BY 1", "chart_type": "bar", "x": "carrier", "y": ["n"]}
    body = {"title": "t", "plan": ["p"], "widgets": [{**chart, "highlight": {"mode": "top", "n": 3}}]}
    did = client.post("/api/dashboards", json=body).json()["id"]
    assert client.get(f"/api/dashboards/{did}").json()["widgets"][0]["highlight"] == {"mode": "top", "n": 3}
    for bad in ({"mode": "top", "n": 6}, {"mode": "top", "n": 0}, {"mode": "mid", "n": 2}):
        assert client.post("/api/dashboards", json={**body, "widgets": [{**chart, "highlight": bad}]}).status_code == 422


# ---------- preview of a draft and changing a saved dashboard

SPEC = {
    "title": "UPS orders", "plan": ["count"],
    "widgets": [{"kind": "kpi", "title": "Orders", "sql": "SELECT count(*) AS n FROM orders WHERE {{WHERE}}", "format": "number"}],
    "filters": [{"key": "carrier", "default": ["UPS"]}],
}


def count(where: str) -> int:
    from sqlalchemy import text

    from app.db.engine import engine

    with engine.connect() as con:
        return con.execute(text(f"SELECT count(*) FROM orders WHERE {where}")).scalar_one()


def test_a_draft_previews_on_its_own_defaults_and_on_the_viewers_filters(client: TestClient) -> None:
    d = client.post("/api/dashboards/preview", json=SPEC).json()
    assert d["widgets"][0]["rows"] == [{"n": count("carrier = 'UPS'")}] and d["applied"]["carrier"] == ["UPS"]
    fed = client.post("/api/dashboards/preview", json={**SPEC, "values": {"carrier": ["FedEx"]}}).json()
    assert fed["widgets"][0]["rows"] == [{"n": count("carrier = 'FedEx'")}]
    everyone = client.post("/api/dashboards/preview", json={**SPEC, "values": {}}).json()  # the viewer cleared the filter: all data
    assert everyone["widgets"][0]["rows"] == [{"n": 400}]


def test_a_preview_follows_only_the_filters_the_draft_declares_and_saves_nothing(client: TestClient) -> None:
    only_region = client.post("/api/dashboards/preview", json={**SPEC, "values": {"region": ["EU"], "carrier": ["UPS"]}}).json()
    assert only_region["applied"]["region"] == [] and only_region["widgets"][0]["rows"] == [{"n": count("carrier = 'UPS'")}]  # region is not offered by this draft
    assert client.get("/api/dashboards").json() == []


def test_a_preview_refuses_bad_values_and_shows_a_bad_widget_as_an_error(client: TestClient) -> None:
    from app.main import app

    assert client.post("/api/dashboards/preview", json={**SPEC, "values": {"carrier": ["Nope"]}}).status_code == 422
    assert client.post("/api/dashboards/preview", json={**SPEC, "filters": [{"key": "carrier", "default": ["Nope"]}]}).status_code == 422
    bad = {**SPEC, "widgets": [{"kind": "kpi", "title": "Evil", "sql": "DROP TABLE orders"}]}
    assert client.post("/api/dashboards/preview", json=bad).json()["widgets"][0]["error"]
    assert TestClient(app).post("/api/dashboards/preview", json=SPEC).status_code == 401


def test_a_saved_dashboard_can_be_replaced_by_its_owner(client: TestClient) -> None:
    did = client.post("/api/dashboards", json=SPEC).json()["id"]
    changed = {**SPEC, "title": "FedEx orders", "plan": ["count FedEx"], "filters": [{"key": "carrier", "default": ["FedEx"]}, {"key": "region"}]}
    assert client.put(f"/api/dashboards/{did}", json=changed).json() == {"id": did}
    d = client.get(f"/api/dashboards/{did}").json()
    assert d["title"] == "FedEx orders" and d["plan"] == ["count FedEx"] and [f["key"] for f in d["filters"]] == ["carrier", "region"]
    assert d["widgets"][0]["rows"] == [{"n": count("carrier = 'FedEx'")}]
    assert [x["title"] for x in client.get("/api/dashboards").json()] == ["FedEx orders"]  # the sidebar list follows
    assert client.put("/api/dashboards/99999", json=SPEC).status_code == 404
    assert client.put(f"/api/dashboards/{did}", json={**SPEC, "filters": [{"key": "carrier", "default": ["Nope"]}]}).status_code == 422
    assert client.get(f"/api/dashboards/{did}").json()["title"] == "FedEx orders"  # a refused change changed nothing


def test_only_the_owner_or_the_admin_can_change_a_dashboard_and_the_ui_is_told(client: TestClient, visitor: TestClient) -> None:
    mine = visitor.post("/api/dashboards", json=SPEC).json()["id"]
    theirs = client.post("/api/dashboards", json=SPEC).json()["id"]
    assert visitor.get(f"/api/dashboards/{mine}").json()["can_edit"] is True
    assert visitor.get(f"/api/dashboards/{theirs}").json()["can_edit"] is False
    assert client.get(f"/api/dashboards/{mine}").json()["can_edit"] is True  # the admin may change any
    assert visitor.put(f"/api/dashboards/{theirs}", json={**SPEC, "title": "hijacked"}).status_code == 404
    assert client.get(f"/api/dashboards/{theirs}").json()["title"] == "UPS orders"
    assert client.put(f"/api/dashboards/{mine}", json={**SPEC, "title": "by admin"}).status_code == 200


# ---------- layout: the width of a widget in a 12-column row

def with_span(**span: object) -> dict:
    return {"title": "t", "plan": ["p"], "widgets": [{"kind": "kpi", "title": "n", "sql": "SELECT count(*) AS n FROM orders", "format": "number", **span}]}


@pytest.mark.parametrize("span", [1, 4, 12])
def test_the_api_takes_a_span_from_1_to_12_and_keeps_it(client: TestClient, span: int) -> None:
    did = client.post("/api/dashboards", json=with_span(span=span)).json()["id"]
    assert client.get(f"/api/dashboards/{did}").json()["widgets"][0]["span"] == span
    assert client.post("/api/dashboards/preview", json=with_span(span=span)).json()["widgets"][0]["span"] == span


@pytest.mark.parametrize("span", [0, 13, -3, "wide", 4.5])
def test_the_api_refuses_a_span_outside_the_grid(client: TestClient, span: object) -> None:
    assert client.post("/api/dashboards", json=with_span(span=span)).status_code == 422


def test_a_widget_without_a_span_has_none_and_is_replaced_with_its_new_span(client: TestClient) -> None:
    did = client.post("/api/dashboards", json=with_span()).json()["id"]
    assert "span" not in client.get(f"/api/dashboards/{did}").json()["widgets"][0]
    assert client.put(f"/api/dashboards/{did}", json=with_span(span=6)).status_code == 200
    assert client.get(f"/api/dashboards/{did}").json()["widgets"][0]["span"] == 6


# ---------- how many widgets a dashboard holds

def many(n: int) -> dict:
    return {"title": "t", "plan": ["p"], "widgets": [{"kind": "kpi", "title": f"k{i}", "sql": "SELECT count(*) AS n FROM orders", "format": "number"} for i in range(n)]}


def test_a_dashboard_holds_up_to_the_widget_limit(client: TestClient) -> None:
    from app.modules.dashboards.schemas import MAX_WIDGETS

    assert MAX_WIDGETS == 24
    did = client.post("/api/dashboards", json=many(MAX_WIDGETS)).json()["id"]
    assert len(client.get(f"/api/dashboards/{did}").json()["widgets"]) == MAX_WIDGETS
    assert client.post("/api/dashboards", json=many(MAX_WIDGETS + 1)).status_code == 422
    assert client.post("/api/dashboards/preview", json=many(MAX_WIDGETS + 1)).status_code == 422
