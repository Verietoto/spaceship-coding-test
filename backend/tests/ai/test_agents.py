"""The agent team's guardrails: what each agent may call, that tools record into the Turn, and that nothing writes."""
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from pydantic import ValidationError

from app.modules.ai import agents
from app.modules.ai import copilot as ai
from app.modules.ai.agents import analyst, builder, charter, forecaster
from app.modules.ai.agents.context import Ctx
from app.modules.ai.agents.profile import FILE_TOOLS
from app.modules.ai.agents.router import REGISTRY, Route, fallback
from app.modules.ai.agents.tools import make_tools
from app.modules.ai.agents.turn import Turn, run_tool
from app.modules.analytics import filters as af
from app.modules.analytics.metrics import ALL_METRICS
from app.modules.dashboards import repository
from tests.conftest import call

ALLOWED = {"set_filters", "open_section", "get_view", "get_kpis", "get_facets", "run_sql", "make_chart", "create_dashboard", "forecast_demand", "remember", "search_kb"}


def turn() -> Turn:
    return Turn(f=af.Filters(), compare="prev")


def test_registry_is_consistent() -> None:
    names = [s.NAME for s in REGISTRY]
    assert names == ["analyst", "charter", "builder", "forecaster"] and len(set(names)) == len(names)
    assert len({s.INTENT for s in REGISTRY}) == len(REGISTRY)
    for s in REGISTRY:
        assert set(s.TOOLS) <= ALLOWED and s.DESCRIPTION and "get_view" in s.TOOLS
        assert s.prompt(Ctx(af.Filters(), "prev", "en"))  # builds without a model


def test_each_subagent_gets_only_its_own_tools() -> None:
    assert set(analyst.TOOLS) == {"get_view", "get_kpis", "get_facets", "run_sql"}
    assert set(charter.TOOLS) == {"get_view", "get_facets", "run_sql", "make_chart"}
    assert set(builder.TOOLS) == {"get_view", "get_facets", "run_sql", "create_dashboard"}
    assert set(forecaster.TOOLS) == {"get_view", "forecast_demand"}
    # changing the view, and drafting dashboards, are never both available to the same agent
    assert not ({"set_filters", "open_section"} & {t for s in REGISTRY for t in s.TOOLS})


def test_no_file_or_shell_tools_exist() -> None:
    assert not (FILE_TOOLS & set(make_tools(turn())))
    assert set(make_tools(turn())) == ALLOWED


def test_coordinator_loads_only_what_the_route_says(fake_model) -> None:  # noqa: ANN001
    ctx = Ctx(af.Filters(), "prev", "en")
    model = fake_model([])
    for route, expected in (
        (Route(subagents=(), tools=()), ["get_view", "remember"]),  # nothing delegated, nothing to change: reads the view
        (Route(subagents=(), tools=("set_filters", "open_section")), ["get_view", "open_section", "remember", "set_filters"]),
        (Route(subagents=("charter",), tools=()), ["get_view", "remember", "task"]),
        (Route(subagents=("analyst",), tools=("search_kb",)), ["get_view", "remember", "search_kb", "task"]),
        (fallback("test"), ["get_view", "open_section", "remember", "search_kb", "set_filters", "task"]),
    ):
        model.seen.clear()
        agents.run(agents.build_copilot(turn(), ctx, route), [("user", "hi")])
        assert model.seen[0] == expected, route


def test_only_routed_subagents_are_offered() -> None:
    p = agents.coordinator_prompt(Ctx(af.Filters(), "prev", "en"), Route(subagents=("charter",), tools=()))
    assert "- charter:" in p and "- analyst:" not in p and "- builder:" not in p
    assert "Tools you have: get_view, remember." in p


def test_the_coordinator_can_explain_every_overview_card() -> None:
    p = agents.coordinator_prompt(Ctx(af.Filters(), "prev", "en"), Route(subagents=(), tools=()))
    for term in ("Orders:", "Order value:", "Delivered:", "Delay rate:", "Lead time P90:", "Orders > 7 days:", "AOV", "percentage points", "Compare"):
        assert term in p, term
    for section in ("Delivery performance:", "Clients:", "Risk and exceptions:", "Demand forecast:", "Data quality:", "Reports:"):
        assert section in p, section


def test_kpis_trace_only_the_metrics_the_model_reports() -> None:
    t = turn()
    run_tool(t, "get_kpis", {"by": "carrier", "metrics": ["delay"]})
    c = t.calc()
    assert c["metrics"] == ["delay"] and c["terms"] == {} and c["formulas"] == []  # grouped: the definition, the figures are in the answer
    t = turn()
    run_tool(t, "get_kpis", {"metrics": ["delay", "bogus"]})  # unknown names are dropped; a total comes with its numbers
    assert list(t.calc()["terms"]) == ["delay"] and t.calc()["terms"]["delay"]["den"] == 400
    t = turn()
    run_tool(t, "get_kpis", {"by": "region"})
    assert t.calc()["metrics"] == ALL_METRICS  # nothing said: all of them


def test_the_coordinator_is_told_how_to_format_answers() -> None:
    p = agents.coordinator_prompt(Ctx(af.Filters(), "prev", "en"), Route(subagents=(), tools=()))
    assert "markdown is rendered" in p and "**bold**" in p and "table only to compare" in p


def test_the_coordinator_answers_from_knowledge_as_its_own() -> None:
    p = agents.coordinator_prompt(Ctx(af.Filters(), "prev", "en"), Route(subagents=(), tools=("search_kb",)))
    assert "simply what you know" in p and "Never mention a knowledge base" in p
    assert "name the document" not in p
    assert "NOT something you know by heart" in p and "Never guess or invent a creator" in p


def test_the_coordinator_knows_who_it_is() -> None:
    p = agents.coordinator_prompt(Ctx(af.Filters(), "prev", "en"), Route(subagents=(), tools=()))
    assert "who are you" in p and "AI copilot built into Spaceship" in p


def test_unsafe_sql_is_refused_through_the_tools() -> None:
    t = turn()
    tools = make_tools(t)
    for name, args in (("run_sql", {"sql": "DROP TABLE orders", "formulas": []}), ("run_sql", {"sql": "SELECT pg_read_file('/etc/passwd')", "formulas": []})):
        assert "error" in json.loads(tools[name].invoke(args))
    out = json.loads(tools["make_chart"].invoke({"sql": "DELETE FROM orders", "formulas": [], "type": "bar", "x": "a", "y": ["b"], "title": "t"}))
    assert "error" in out and t.chart is None and t.queries == []
    assert af.total_orders() == 400


def test_tools_record_into_the_turn() -> None:
    t = turn()
    tools = make_tools(t)
    tools["set_filters"].invoke({"carrier": ["UPS"], "period": "Q4"})
    assert t.f.carrier == ("UPS",) and {c["key"] for c in t.changes} == {"carrier", "start", "end"}
    kpis = json.loads(tools["get_kpis"].invoke({}))
    assert kpis["stats"]["n"] == 15
    by = json.loads(tools["get_kpis"].invoke({"by": "region"}))
    assert sum(r["n"] for r in by["rows"]) == 15 and len(t.queries) == 2
    json.loads(tools["make_chart"].invoke({"sql": "SELECT region, count(*) AS n FROM orders GROUP BY 1", "formulas": ["n = orders"], "type": "bar", "x": "region", "y": ["n"], "title": "x"}))
    assert t.chart and len(t.chart["rows"]) == 5
    with pytest.raises(ValidationError):  # the tool's own schema refuses it before it reaches our code...
        tools["get_kpis"].invoke({"by": "nonsense"})
    assert "error" in run_tool(t, "get_kpis", {"by": "nonsense"})  # ...and so does the function behind it
    view = json.loads(tools["get_view"].invoke({}))
    assert view["orders_in_filter"] == 15 and view["data_range"]["start"] == "2025-01-01"
    facets = json.loads(tools["get_facets"].invoke({}))
    assert facets["total"] == 15 and {r["value"] for r in facets["carrier"]} >= {"UPS", "FedEx"}
    tools["open_section"].invoke({"section": "risk"})
    assert t.section == "risk"


def test_create_dashboard_reports_bad_widgets_and_saves_nothing() -> None:
    t = turn()
    before = repository.list_dashboards()
    widgets = [
        {"kind": "kpi", "title": "ok", "sql": "SELECT count(*) AS n FROM orders", "formulas": []},
        {"kind": "kpi", "title": "bad", "sql": "DROP TABLE orders", "formulas": []},
    ]
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["a"], "widgets": widgets}))
    assert out["ok"] is False and out["widgets_with_errors"][0]["title"] == "bad"
    assert t.dashboard and t.dashboard["widgets"][0]["rows"] == [{"n": 400}]
    assert repository.list_dashboards() == before  # a draft lives in the Turn only; saving is the user's button
    assert "error" in json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": [], "widgets": []}))


def test_running_out_of_steps_is_an_answer_not_an_error(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    monkeypatch.setattr(agents, "RECURSION_LIMIT", 5)
    fake_model([call("get_view", {}, f"c{i}") for i in range(30)])
    out = ai.copilot("loop forever", [], af.Filters(), "prev", "en")
    assert out["answer"] == "That took too many steps."
    assert ai.copilot.__module__  # response keeps its shape
    assert set(out) == {"answer", "changes", "filters", "compare", "section", "chart", "calc", "route", "remembered", "guard"}


def test_builder_without_a_draft_is_a_502(client: TestClient, fake_model) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="I could not.")])
    r = client.post("/api/builder", json={"prompt": "dashboard please"})
    assert r.status_code == 502


def test_response_model_drops_internal_fields(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    full = {"answer": "a", "changes": [], "filters": {}, "compare": "prev", "section": None, "chart": None, "calc": None, "route": None,
            "messages": ["internal"], "todos": ["x"], "files": {"/a": "b"}}
    monkeypatch.setattr(ai, "copilot", lambda *a, **k: full)
    r = client.post("/api/copilot", json={"message": "hi"})
    assert r.status_code == 200 and not ({"messages", "todos", "files"} & set(r.json()))


def test_without_an_openai_key_ai_endpoints_are_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert client.post("/api/copilot", json={"message": "hi"}).status_code == 503
    assert client.post("/api/builder", json={"prompt": "dashboard please"}).status_code == 503


def test_builder_prompt_shows_the_filter_marker_with_its_real_braces() -> None:
    """The prompt is an f-string: a literal {{WHERE}} would reach the model as {WHERE}, which it copied, and every query failed."""
    from app.modules.ai.agents import builder
    from app.modules.dashboards.service import PLACEHOLDER

    text = builder.prompt(Ctx(af.Filters(), "prev", "en"))
    assert PLACEHOLDER in text and "{WHERE}" not in text.replace(PLACEHOLDER, "")


def test_builder_prompt_tells_it_to_follow_the_chosen_chart_type() -> None:
    from app.modules.ai.agents import builder

    assert "chart type" in builder.prompt(Ctx(af.Filters(), "prev", "en")).lower()


# ---------- highlight: mark the best or worst bars

CHART = {"kind": "chart", "title": "Orders per carrier", "sql": "SELECT carrier, count(*) AS n FROM orders GROUP BY 1", "formulas": [], "chart_type": "bar", "x": "carrier", "y": ["n"]}


def test_a_chart_keeps_a_valid_highlight_and_drops_a_bad_one() -> None:
    from app.modules.ai.agents.widgets import clean_widget

    assert clean_widget({**CHART, "highlight": {"mode": "top", "n": 3}})["highlight"] == {"mode": "top", "n": 3}
    for bad in ({"mode": "middle", "n": 3}, {"mode": "top", "n": 0}, {"mode": "top", "n": 6}, {"mode": "top", "n": "3"}, {"mode": "top"}, "top 3", None):
        assert "highlight" not in clean_widget({**CHART, "highlight": bad})
    assert "highlight" not in clean_widget({"kind": "kpi", "title": "k", "sql": "SELECT 1", "highlight": {"mode": "top", "n": 3}})  # a KPI has no bars


def test_create_dashboard_passes_the_highlight_to_the_draft() -> None:
    t = turn()
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["a"], "widgets": [{**CHART, "highlight": {"mode": "bottom", "n": 2}}]}))
    assert out.get("ok") is not False
    assert t.dashboard["widgets"][0]["highlight"] == {"mode": "bottom", "n": 2}


def test_the_tool_schema_limits_the_highlight() -> None:
    with pytest.raises(ValidationError):
        make_tools(turn())["create_dashboard"].invoke({"title": "T", "plan": ["a"], "widgets": [{**CHART, "highlight": {"mode": "top", "n": 9}}]})


def test_builder_prompt_explains_the_highlight() -> None:
    from app.modules.ai.agents import builder as b

    text = b.prompt(Ctx(af.Filters(), "prev", "en"))
    assert "highlight" in text and "bottom" in text


# ---------- layout: span

@pytest.mark.parametrize(("kind", "given", "kept"), [
    ("chart", 4, 4), ("chart", 6, 6), ("chart", 12, 12),
    ("chart", 2, 4), ("chart", 1, 4),  # a chart is not readable narrower than a third of a row
    ("kpi", 3, 3), ("kpi", 1, 2), ("kpi", 99, 12), ("chart", 40, 12),
    ("chart", 6.0, 6),
])
def test_a_span_is_tidied_into_the_readable_range(kind: str, given: float, kept: int) -> None:
    from app.modules.ai.agents.widgets import clean_widget

    base = {"kind": kind, "title": "w", "sql": "SELECT 1", "chart_type": "bar", "x": "a", "y": ["b"]}
    assert clean_widget({**base, "span": given})["span"] == kept


@pytest.mark.parametrize("junk", ["wide", None, True, [4], {"n": 4}, 4.5])
def test_a_span_that_is_not_a_whole_number_is_dropped_not_fatal(junk: object) -> None:
    from app.modules.ai.agents.widgets import clean_widget

    assert "span" not in clean_widget({"kind": "chart", "title": "w", "sql": "SELECT 1", "span": junk})
    assert "span" not in clean_widget({"kind": "kpi", "title": "w", "sql": "SELECT 1"})  # no layout asked, no layout made up


def test_create_dashboard_hands_the_layout_to_the_draft_in_the_order_given() -> None:
    t = turn()
    chart = {"kind": "chart", "title": "c", "sql": "SELECT carrier, count(*) AS n FROM orders GROUP BY 1", "chart_type": "bar", "x": "carrier", "y": ["n"], "formulas": []}
    widgets = [{**chart, "title": "a", "span": 4}, {**chart, "title": "b", "span": 4}, {**chart, "title": "c", "span": 4}, {**chart, "title": "d"}]
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["x"], "widgets": widgets}))
    assert out.get("ok") is not False
    assert [(w["title"], w.get("span")) for w in t.dashboard["widgets"]] == [("a", 4), ("b", 4), ("c", 4), ("d", None)]


def test_the_agents_are_told_how_to_lay_widgets_out() -> None:
    from app.modules.ai.agents import builder as b

    prompt = b.prompt(Ctx(af.Filters(), "prev", "en"))
    assert "span" in prompt and "12-column" in prompt and "one after the other" in prompt and "leave `span` out" in prompt
    spec = make_tools(turn())["create_dashboard"].args_schema.model_json_schema()
    assert "span" in json.dumps(spec) and "12 = a whole row" in json.dumps(spec)


# ---------- the widget limit is never applied silently

from app.modules.dashboards.schemas import MAX_WIDGETS  # noqa: E402

def widget(i: int) -> dict:
    return {"kind": "kpi", "title": f"w{i}", "sql": "SELECT count(*) AS n FROM orders", "formulas": []}


def test_a_ninth_widget_is_kept_not_cut() -> None:
    """The saved dashboard had 8 widgets, and 'add a table' made 9: the new one used to be dropped without a word."""
    t = turn()
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["x"], "widgets": [widget(i) for i in range(9)]}))
    assert out.get("ok") is not False and [w["title"] for w in t.dashboard["widgets"]][-1] == "w8" and len(t.dashboard["widgets"]) == 9


def test_more_than_the_limit_is_refused_with_a_reason_the_agent_can_act_on() -> None:
    t = turn()
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["x"], "widgets": [widget(i) for i in range(MAX_WIDGETS + 1)]}))
    assert f"at most {MAX_WIDGETS}" in out["error"] and str(MAX_WIDGETS + 1) in out["error"] and t.dashboard is None
    assert t.dashboard_error == out["error"]  # a build that gives up reports this to the user
    ok = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["x"], "widgets": [widget(i) for i in range(MAX_WIDGETS)]}))
    assert ok.get("ok") is not False and len(t.dashboard["widgets"]) == MAX_WIDGETS and t.dashboard_error is None


def test_the_builder_is_told_the_limit_and_not_to_drop_silently() -> None:
    from app.modules.ai.agents import builder as b

    assert f"at most {MAX_WIDGETS} widgets" in b.prompt(Ctx(af.Filters(), "prev", "en"))


# ---------- more chart types

def test_every_chart_type_is_kept_and_an_unknown_one_becomes_a_bar() -> None:
    from app.modules.ai.agents.widgets import clean_widget
    from app.modules.ai.llm import CHART_TYPES

    assert {"bar", "hbar", "stacked_bar", "area", "line", "combo", "histogram", "pie", "table", "heatmap", "scatter", "funnel", "treemap", "radar", "sankey"} == set(CHART_TYPES)
    for kind in CHART_TYPES:
        assert clean_widget({"kind": "chart", "title": "w", "sql": "SELECT 1", "chart_type": kind})["chart_type"] == kind
    assert clean_widget({"kind": "chart", "title": "w", "sql": "SELECT 1", "chart_type": "spiral"})["chart_type"] == "bar"


def test_series_lines_and_target_survive_cleaning_and_junk_does_not() -> None:
    from app.modules.ai.agents.widgets import clean_widget

    w = {"kind": "chart", "title": "w", "sql": "SELECT 1", "chart_type": "combo", "x": "m", "y": [f"c{i}" for i in range(12)], "y_line": ["a", "b", "c", "d", "e"], "series": "region", "target": 10}
    out = clean_widget(w)
    assert len(out["y"]) == 8 and out["y_line"] == ["a", "b", "c", "d"] and out["series"] == "region" and out["target"] == 10.0
    for bad in ["10", True, float("nan"), float("inf"), None]:
        assert "target" not in clean_widget({**w, "target": bad})


def test_a_kpi_target_comes_with_which_direction_is_better() -> None:
    from app.modules.ai.agents.widgets import clean_widget

    k = {"kind": "kpi", "title": "k", "sql": "SELECT 1", "target": 10}
    assert clean_widget(k)["better"] == "high" and clean_widget({**k, "better": "low"})["better"] == "low" and clean_widget({**k, "better": "x"})["better"] == "high"
    assert "target" not in clean_widget({**k, "target": "10"}) and "better" not in clean_widget({**k, "target": "10"})


def test_columns_the_chart_names_must_be_in_the_result_and_numeric() -> None:
    from app.modules.ai.agents.widgets import missing_columns

    rows = [{"carrier": "UPS", "region": "UK", "delay": 12.5}, {"carrier": "DHL", "region": "EU", "delay": None}]
    ok = {"kind": "chart", "chart_type": "stacked_bar", "x": "carrier", "series": "region", "y": ["delay"]}
    assert missing_columns(ok, rows) is None
    assert "region_name" in (missing_columns({**ok, "series": "region_name"}, rows) or "")
    assert "must be numeric" in (missing_columns({**ok, "y": ["region"]}, rows) or "")
    assert missing_columns({**ok, "y": []}, rows) is not None  # nothing to plot
    assert missing_columns({**ok, "chart_type": "table", "y": []}, rows) is None  # a table shows whatever came back
    assert missing_columns(ok, []) is None  # an empty result is not a column problem
    assert missing_columns({"kind": "kpi"}, rows) is None


def test_the_saved_widget_schema_accepts_the_new_fields() -> None:
    from app.modules.dashboards.schemas import Widget

    w = Widget(kind="chart", title="t", sql="SELECT 1", chart_type="hbar", x="a", y=["b"], series="c", y_line=["d"], target=5)
    assert w.chart_type == "hbar" and w.series == "c" and w.target == 5
    with pytest.raises(ValueError):
        Widget(kind="chart", title="t", sql="SELECT 1", chart_type="spiral")


def test_create_dashboard_reports_a_chart_whose_columns_do_not_match_the_sql() -> None:
    t = turn()
    bad = {**CHART, "chart_type": "stacked_bar", "series": "region"}  # the SQL returns carrier and n only
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["a"], "widgets": [bad]}))
    assert out["ok"] is False and "region" in out["widgets_with_errors"][0]["error"]


def test_create_dashboard_keeps_a_long_format_chart_that_matches() -> None:
    t = turn()
    sql = "SELECT carrier, region, count(*) AS n FROM orders GROUP BY 1, 2"
    good = {**CHART, "sql": sql, "chart_type": "stacked_bar", "series": "region", "y": ["n"], "target": 5}
    out = json.loads(make_tools(t)["create_dashboard"].invoke({"title": "T", "plan": ["a"], "widgets": [good]}))
    assert out["ok"] is True
    w = t.dashboard["widgets"][0]
    assert (w["chart_type"], w["series"], w["target"]) == ("stacked_bar", "region", 5.0)


def test_make_chart_refuses_columns_that_are_not_in_the_result_and_keeps_the_new_fields_otherwise() -> None:
    t = turn()
    sql = "SELECT carrier, region, count(*) AS n FROM orders GROUP BY 1, 2"
    tools = make_tools(t)
    bad = json.loads(tools["make_chart"].invoke({"sql": sql, "formulas": [], "type": "bar", "x": "carrier", "y": ["orders"], "title": "t"}))
    assert "error" in bad and t.chart is None
    json.loads(tools["make_chart"].invoke({"sql": sql, "formulas": [], "type": "stacked_bar", "x": "carrier", "y": ["n"], "series": "region", "target": 3, "title": "t"}))
    assert t.chart["type"] == "stacked_bar" and t.chart["series"] == "region" and t.chart["target"] == 3.0


def test_builder_and_charter_prompts_teach_the_new_chart_types() -> None:
    from app.modules.ai.agents import builder as b
    from app.modules.ai.agents import charter as c

    text = b.prompt(Ctx(af.Filters(), "prev", "en"))
    for word in ("hbar", "stacked_bar", "combo", "histogram", "series", "y_line", "target"):
        assert word in text, word
    assert "stacked bar" in c.DESCRIPTION and "stacked_bar" in c.prompt(Ctx(af.Filters(), "prev", "en")) and "series" in c.prompt(Ctx(af.Filters(), "prev", "en"))


def test_heatmap_and_sankey_need_a_series_column_and_scatter_numeric_axes() -> None:
    from app.modules.ai.agents.widgets import missing_columns

    rows = [{"carrier": "UPS", "region": "UK", "delay": 12.5, "value": 100, "age": 3}]
    heat = {"kind": "chart", "chart_type": "heatmap", "x": "carrier", "series": "region", "y": ["delay"]}
    assert missing_columns(heat, rows) is None
    assert "needs `series`" in (missing_columns({**heat, "series": None}, rows) or "")
    assert "needs `series`" in (missing_columns({**heat, "chart_type": "sankey", "series": None}, rows) or "")
    scatter = {"kind": "chart", "chart_type": "scatter", "x": "value", "y": ["age"], "size": "delay"}
    assert missing_columns(scatter, rows) is None
    assert "must be numeric" in (missing_columns({**scatter, "x": "carrier"}, rows) or "")  # a scatter's x is a number
    assert "must be numeric" in (missing_columns({**scatter, "size": "region"}, rows) or "")
    assert "size_col" in (missing_columns({**scatter, "size": "size_col"}, rows) or "")


def test_the_size_of_a_bubble_survives_cleaning() -> None:
    from app.modules.ai.agents.widgets import clean_widget

    w = {"kind": "chart", "title": "w", "sql": "SELECT 1", "chart_type": "scatter", "x": "a", "y": ["b"], "size": "c"}
    assert clean_widget(w)["size"] == "c" and "size" not in clean_widget({**w, "size": ""})


def test_prompts_teach_heatmap_scatter_and_sankey() -> None:
    from app.modules.ai.agents import builder as b

    text = b.prompt(Ctx(af.Filters(), "prev", "en"))
    for word in ("heatmap", "scatter", "treemap", "funnel", "radar", "sankey", "size"):
        assert word in text, word
