"""Copilot guardrails: the filter changes the model makes and the calc trace. No API key needed."""

from app.modules.ai import copilot as ai
from app.modules.analytics import filters as m


def test_filters_stack_and_replace() -> None:
    turn = ai.Turn(f=m.Filters(), compare="prev")
    ai.run_tool(turn, "set_filters", {"carrier": ["UPS"]})
    ai.run_tool(turn, "set_filters", {"period": "Q4"})
    assert (turn.f.carrier, str(turn.f.start), str(turn.f.end)) == (("UPS",), "2025-10-01", "2025-12-31")  # dimensions stack
    ai.run_tool(turn, "set_filters", {"carrier": ["DHL", "FedEx"]})
    assert turn.f.carrier == ("DHL", "FedEx") and str(turn.f.start) == "2025-10-01"  # a dimension is replaced by its new list
    ai.run_tool(turn, "set_filters", {"carrier": "UPS"})  # a plain string is accepted too
    assert turn.f.carrier == ("UPS",)
    ai.run_tool(turn, "set_filters", {"region": ["EU", "UK"], "exclude": ["region"]})
    assert turn.f.region == ("EU", "UK") and turn.f.exclude == ("region",)
    ai.run_tool(turn, "set_filters", {"start": "2025-02-10", "end": "2025-03-05"})
    assert (str(turn.f.start), str(turn.f.end)) == ("2025-02-10", "2025-03-05")
    ai.run_tool(turn, "set_filters", {"period": "all", "region": []})
    assert turn.f.start is None and turn.f.end is None and turn.f.region == ()
    before = turn.f
    for bad in ({"carrier": ["Bogus"]}, {"start": "not-a-date"}, {"period": "Q9"}, {"start": "2025-05-01", "end": "2025-04-01"}):
        assert ai.run_tool(turn, "set_filters", bad)["error"]
        assert turn.f == before  # an invalid value leaves the filters unchanged
    ai.run_tool(turn, "set_filters", {"reset": True})
    assert turn.f == m.Filters()


def test_changes_are_recorded() -> None:
    turn = ai.Turn(f=m.Filters(), compare="prev")
    ai.run_tool(turn, "set_filters", {"carrier": ["UPS"], "period": "Q4", "compare": "base"})
    changed = {c["key"]: c["to"] for c in turn.changes}
    assert changed == {"start": "2025-10-01", "end": "2025-12-31", "carrier": ["UPS"], "compare": "base"}


def test_chart_and_calc_trace() -> None:
    turn = ai.Turn(f=m.Filters(carrier=("UPS",)), compare="prev")
    out = ai.run_tool(
        turn,
        "make_chart",
        {"sql": "SELECT region, count(*) AS n FROM orders WHERE carrier = 'UPS' GROUP BY region", "formulas": ["n = orders"], "type": "bar", "x": "region", "y": ["n"], "title": "UPS"},
    )
    assert out["shown_to_user"] and turn.chart and len(turn.chart["rows"]) == 5
    calc = turn.calc()
    assert calc and "carrier = 'UPS'" in calc["sql"] and calc["rows"] == 88
    assert ai.run_tool(turn, "run_sql", {"sql": "DROP TABLE orders", "formulas": []})["error"]


def test_copilot_runs_the_agent_team(fake_model) -> None:  # noqa: ANN001
    """The coordinator sets filters, delegates to the analyst, and the analyst's query reaches the response."""
    from tests.conftest import call
    from langchain_core.messages import AIMessage

    model = fake_model([
        call("set_filters", {"carrier": ["UPS"], "period": "Q4"}),  # coordinator
        call("task", {"description": "How many orders?", "subagent_type": "analyst"}),  # coordinator delegates
        call("get_kpis", {}),  # analyst
        AIMessage(content="UPS had 15 orders in Q4."),  # analyst's answer
        AIMessage(content="UPS di Q4: 15 order."),  # coordinator's answer
    ])
    out = ai.copilot("Fokus ke UPS di Q4, berapa order?", [], m.Filters(), "prev", "id")

    assert out["answer"] == "UPS di Q4: 15 order."
    assert (out["filters"]["carrier"], out["filters"]["start"], out["filters"]["end"]) == (["UPS"], "2025-10-01", "2025-12-31")
    assert {c["key"] for c in out["changes"]} == {"carrier", "start", "end"}
    assert out["calc"]["rows"] == 15 and "carrier = 'UPS'" in out["calc"]["sql"]  # the analyst's query is in the trace
    # get_kpis leaves the dashboard's metrics WITH their numbers (the UI shows the math), not a placeholder sentence
    assert out["calc"]["terms"]["delay"]["den"] == 15 and "orders" in out["calc"]["metrics"]
    assert not out["calc"]["formulas"] and "as defined on the dashboard" not in str(out["calc"])
    assert out["route"]["source"] == "fallback"  # no TYPESAFE_API_KEY in tests
    assert model.seen[0] == ["get_view", "open_section", "remember", "search_kb", "set_filters", "task"]  # the coordinator never sees a SQL or file tool
