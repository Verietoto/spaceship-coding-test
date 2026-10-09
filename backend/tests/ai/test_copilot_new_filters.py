"""Copilot and forecast with the new filters: set_filters, get_kpis by the new groups, forecast_demand."""
import json

import pytest

from app.db.engine import query
from app.modules.ai.agents import tools
from app.modules.ai.agents import turn as turn_mod
from app.modules.analytics import filters as af


def call(t: turn_mod.Turn, name: str, **args: object) -> dict:
    return json.loads(tools.make_tools(t)[name].invoke(args))


def fresh(**f: object) -> turn_mod.Turn:
    return turn_mod.Turn(f=af.Filters(**f), compare="prev")


def sql(where: str) -> int:
    return query(f"SELECT count(*) AS n FROM orders WHERE {where}")[0]["n"]


# ---------- set_filters

def test_set_filters_takes_the_new_value_filters() -> None:
    t = fresh()
    out = call(t, "set_filters", category=["PAPER", "CRAYON"], status=["delayed"], promo=["0"], origin=["London, UK"], sku=["CRAYON-0017"])
    assert t.f.category == ("CRAYON", "PAPER") and t.f.status == ("delayed",) and t.f.promo == ("0",) and out["orders_in_filter"] == sql(af.where(t.f))
    assert {c["key"] for c in t.changes} >= {"category", "status", "promo", "origin", "sku"}


def test_set_filters_sets_number_ranges_a_bound_at_a_time() -> None:
    t = fresh()
    call(t, "set_filters", value_min=50)
    call(t, "set_filters", value_max=150, quantity_min=2)  # the earlier lower bound stays
    assert t.f.ranges == (("quantity", 2.0, None), ("value", 50.0, 150.0))
    assert [c for c in t.changes if c["key"] == "ranges"][-1]["to"] == {"quantity": [2.0, None], "value": [50.0, 150.0]}
    call(t, "set_filters", value_max=80)
    assert dict((k, (lo, hi)) for k, lo, hi in t.f.ranges)["value"] == (50.0, 80.0)


def test_set_filters_sets_and_clears_arrival_dates_and_ranges() -> None:
    t = fresh()
    call(t, "set_filters", arrived_start="2025-03-01", arrived_end="2025-03-31", lead_max=7, age_min=30)
    assert str(t.f.arrived_start) == "2025-03-01" and str(t.f.arrived_end) == "2025-03-31" and len(t.f.ranges) == 2
    call(t, "set_filters", clear_ranges=["arrived", "lead"])
    assert t.f.arrived_start is None and t.f.arrived_end is None and t.f.ranges == (("age", 30.0, None),)
    call(t, "set_filters", reset=True)
    assert t.f == af.Filters()


def test_set_filters_refuses_what_the_data_does_not_have() -> None:
    for bad in ({"category": ["Nope"]}, {"status": ["lost"]}, {"value_min": 90, "value_max": 10}, {"lead_min": "x"}, {"arrived_start": "someday"}):
        t = fresh()
        assert "invalid filter value" in turn_mod.run_tool(t, "set_filters", bad)["error"] and t.f == af.Filters() and t.changes == []


def test_the_view_the_agents_read_shows_the_new_filters() -> None:
    t = fresh(status=("delayed",), ranges=(("value", 50.0, None),))
    view = call(t, "get_view")
    assert view["filters"]["status"] == ["delayed"] and view["filters"]["ranges"] == {"value": [50.0, None]}
    assert "status = 'delayed'" in view["where"] and "order_value_usd >= 50" in view["where"]


# ---------- get_kpis

@pytest.mark.parametrize(("by", "col", "groups"), [
    ("category", "product_category", 8), ("status", "status", 5), ("promo", "is_promo", 2), ("origin", "origin_city", 9), ("destination", "destination_city", 47),
])
def test_get_kpis_groups_by_the_new_dimensions(by: str, col: str, groups: int) -> None:
    out = call(fresh(), "get_kpis", by=by)
    assert len(out["rows"]) == groups and sum(r["n"] for r in out["rows"]) == 400
    paper = next(r for r in call(fresh(), "get_kpis", by="category")["rows"] if r["key"] == "PAPER")
    assert paper["n"] == sql("product_category = 'PAPER'")


def test_get_kpis_does_not_group_by_sku_and_says_so() -> None:
    t = fresh()
    with pytest.raises(Exception):  # the tool's own schema refuses it before it runs
        tools.make_tools(t)["get_kpis"].invoke({"by": "sku"})
    assert "by must be one of" in turn_mod.run_tool(t, "get_kpis", {"by": "sku"})["error"]


def test_a_filter_on_the_grouping_dimension_does_not_hide_the_other_groups() -> None:
    rows = call(fresh(category=("PAPER",)), "get_kpis", by="category")["rows"]
    assert len(rows) == 8  # like the dashboard's rankings: a dimension is not narrowed by its own filter


# ---------- forecast

def test_the_forecast_tool_follows_the_new_filters() -> None:
    t = fresh(status=("delivered",))
    out = call(t, "forecast_demand", metric="orders", horizon=3)
    assert sum(out["last_12_months"]) == sql("status = 'delivered'")
    t2 = fresh()
    named = call(t2, "forecast_demand", metric="orders", status=["delayed"], value_min=50)
    assert named["filters"]["status"] == ["delayed"] and sum(named["last_12_months"]) == sql("status = 'delayed' AND order_value_usd >= 50")
    assert t2.f == af.Filters()  # a forecast for one status leaves the view alone


def test_a_sku_or_category_argument_of_the_forecast_is_still_its_own_parameter() -> None:
    out = call(fresh(), "forecast_demand", metric="units", sku="CRAYON-0017", horizon=3)
    assert out["sku_basis"]["category"] == "CRAYON" and out["filters"]["sku"] == []  # estimated from the category, not filtered to the SKU


# ---------- what the agents are told

def test_the_agents_know_the_new_values() -> None:
    from app.modules.ai.agents.context import Ctx, reference

    ref = reference(Ctx(af.Filters(), "prev", "en"))
    for text in ("category: BOOK", "status: delivered, delayed", "promo: 1", "origin city:", "355 SKUs", "number ranges", "arrival date"):
        assert text in ref, text
    from app.modules.ai.agents import builder

    prompt = builder.prompt(Ctx(af.Filters(), "prev", "en"))
    assert "category" in prompt and "number ranges" in prompt
