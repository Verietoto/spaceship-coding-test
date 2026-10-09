"""Dashboards with filters the agent chose: {{WHERE}} in widget SQL, defaults, what a viewer may change, and the tool's checks."""
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.modules.ai.agents import turn as turn_mod
from app.modules.analytics import filters as af
from app.modules.dashboards import service
from tests.conftest import call

COUNT = {"kind": "kpi", "title": "Orders", "sql": "SELECT count(*) AS n FROM orders WHERE {{WHERE}}", "formulas": ["orders = rows"], "format": "number"}
ALL_TIME = {"kind": "kpi", "title": "All orders", "sql": "SELECT count(*) AS n FROM orders", "formulas": [], "format": "number"}


def save(client: TestClient, filters: list[dict], widgets: list[dict] | None = None) -> int:
    r = client.post("/api/dashboards", json={"title": "D", "plan": ["x"], "widgets": widgets or [COUNT, ALL_TIME], "filters": filters})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def n(d: dict, i: int = 0) -> int:
    return d["widgets"][i]["rows"][0]["n"]


# ---------- the marker

def test_the_marker_becomes_the_validated_clause() -> None:
    assert service.with_filters("SELECT 1 WHERE {{WHERE}}", af.Filters()) == "SELECT 1 WHERE TRUE"
    sql = service.with_filters("SELECT 1 WHERE {{WHERE}}", af.Filters(carrier=("UPS",)))
    assert "carrier = 'UPS'" in sql and "{{" not in sql
    rows = service.render_widgets([COUNT, ALL_TIME], af.Filters(carrier=("UPS",)))
    assert (rows[0]["rows"][0]["n"], rows[1]["rows"][0]["n"]) == (88, 400)  # the widget without the marker ignores the filters


# ---------- opening a saved dashboard

def test_it_opens_on_the_defaults_and_follows_the_viewer(client: TestClient) -> None:
    did = save(client, [{"key": "carrier", "default": ["UPS"]}, {"key": "period"}])
    first = client.get(f"/api/dashboards/{did}").json()
    assert n(first) == 88 and first["applied"]["carrier"] == ["UPS"]
    assert [f["key"] for f in first["filters"]] == ["carrier", "period"]
    fedex = client.get(f"/api/dashboards/{did}", params={"custom": "true", "carrier": "FedEx"}).json()
    assert n(fedex) != 88 and fedex["applied"]["carrier"] == ["FedEx"]
    assert n(client.get(f"/api/dashboards/{did}", params={"custom": "true"}).json()) == 400  # custom and empty: the viewer cleared the default
    q4 = client.get(f"/api/dashboards/{did}", params={"custom": "true", "start": "2025-10-01", "end": "2025-12-31"}).json()
    assert 0 < n(q4) < 400


def test_a_viewer_cannot_narrow_by_a_filter_the_dashboard_does_not_offer(client: TestClient) -> None:
    did = save(client, [{"key": "carrier"}])
    both = client.get(f"/api/dashboards/{did}", params={"custom": "true", "carrier": "UPS", "region": "EU", "start": "2025-01-01"}).json()
    assert n(both) == 88 and both["applied"]["region"] == [] and both["applied"]["start"] is None


def test_values_the_data_does_not_contain_are_422(client: TestClient) -> None:
    did = save(client, [{"key": "carrier"}])
    assert client.get(f"/api/dashboards/{did}", params={"custom": "true", "carrier": "NOPE"}).status_code == 422


def test_a_dashboard_without_filters_is_unchanged(client: TestClient) -> None:
    did = save(client, [])
    d = client.get(f"/api/dashboards/{did}").json()
    assert d["filters"] == [] and n(d) == 400 and n(d, 1) == 400
    assert n(client.get(f"/api/dashboards/{did}", params={"custom": "true", "carrier": "UPS"}).json()) == 400  # nothing to follow


def test_saving_rejects_bad_filters(client: TestClient) -> None:
    body = {"title": "D", "widgets": [COUNT]}
    assert client.post("/api/dashboards", json={**body, "filters": [{"key": "colour"}]}).status_code == 422  # not a known filter
    assert client.post("/api/dashboards", json={**body, "filters": [{"key": "carrier", "default": ["NOPE"]}]}).status_code == 422
    assert client.post("/api/dashboards", json={**body, "filters": [{"key": "period", "start": "2025-12-01", "end": "2025-01-01"}]}).status_code == 422


# ---------- what the agent does

def make(args: dict) -> tuple[turn_mod.Turn, dict]:
    t = turn_mod.Turn(f=af.Filters(), compare="none")
    return t, turn_mod.run_tool(t, "create_dashboard", args)


def test_create_dashboard_keeps_the_filters_and_renders_on_their_defaults() -> None:
    t, out = make({"title": "T", "plan": [], "widgets": [COUNT], "filters": [{"key": "carrier", "default": ["UPS"]}, {"key": "period", "start": "2025-10-01", "end": "2025-12-31"}]})
    assert out["ok"] is True
    assert t.dashboard["filters"] == [{"key": "carrier", "default": ["UPS"]}, {"key": "period", "start": "2025-10-01", "end": "2025-12-31"}]
    assert t.dashboard["applied"]["carrier"] == ["UPS"] and t.dashboard["widgets"][0]["rows"][0]["n"] == 15  # UPS in Q4


@pytest.mark.parametrize(("filters", "widgets", "expect"), [
    ([{"key": "colour"}], [COUNT], "unknown filter"),
    ([{"key": "carrier", "default": ["NOPE"]}], [COUNT], "invalid carrier"),
    ([{"key": "carrier"}], [ALL_TIME], "{{WHERE}}"),  # filters that nothing follows would do nothing
])
def test_create_dashboard_hands_filter_mistakes_back_to_the_agent(filters: list, widgets: list, expect: str) -> None:
    t, out = make({"title": "T", "plan": [], "widgets": widgets, "filters": filters})
    assert expect in out["error"] and t.dashboard is None


def test_run_sql_fills_the_marker_with_the_current_view_so_widgets_can_be_tested() -> None:
    t = turn_mod.Turn(f=af.Filters(carrier=("UPS",)), compare="none")
    out = turn_mod.run_tool(t, "run_sql", {"sql": "SELECT count(*) AS n FROM orders WHERE {{WHERE}}", "formulas": []})
    assert out["rows"] == [{"n": 88}] and "{{" not in t.queries[0]["sql"]


def test_the_builder_returns_the_filters_it_chose(client: TestClient, fake_model) -> None:  # noqa: ANN001
    spec = {"title": "SLA", "plan": ["p"], "widgets": [COUNT], "filters": [{"key": "carrier", "default": ["UPS"]}]}
    fake_model([call("create_dashboard", spec), AIMessage(content="SLA")])
    draft = client.post("/api/builder", json={"prompt": "dashboard UPS"}).json()
    assert draft["filters"] == [{"key": "carrier", "default": ["UPS"]}] and draft["applied"]["carrier"] == ["UPS"]
    assert draft["widgets"][0]["rows"][0]["n"] == 88


def test_the_progress_shows_which_filters_were_declared(fake_model) -> None:  # noqa: ANN001
    from app.modules.ai import builder

    spec = {"title": "SLA", "plan": ["p"], "widgets": [COUNT], "filters": [{"key": "carrier"}, {"key": "period"}]}
    fake_model([call("create_dashboard", spec, "z"), AIMessage(content="SLA")])
    create = next(e for e in builder.stream_build("dashboard", "en") if e["type"] == "tool" and e["name"] == "create_dashboard")
    assert create["args"]["filters"] == ["carrier", "period"] and create["args"]["widgets"] == ["Orders"]
