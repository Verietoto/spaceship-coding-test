"""Demand forecast: the methods, how one is chosen, SKU -> category, inventory, the API and the Copilot tool."""
import json
import math

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.engine import engine
from app.modules.ai.agents import forecaster, tools
from app.modules.ai.agents import turn as turn_mod
from app.modules.analytics import filters as af
from app.modules.analytics import forecast as fc

ALL = af.Filters()
FLAT = [10.0] * 12
RISING = [10.0 + 2 * i for i in range(12)]


# ---------- the methods

def test_each_method_on_a_flat_series_predicts_the_level() -> None:
    for m in (*fc.METHODS, "naive"):
        assert fc.predict(m, FLAT, 3)[0] == pytest.approx([10.0] * 3), m


def test_moving_average_is_the_mean_of_the_last_three_months() -> None:
    assert fc.predict("moving_average", [1, 2, 3, 4], 2) == ([3.0, 3.0], {"window": 3})
    assert fc.predict("moving_average", [5], 1)[0] == [5.0]  # fewer months than the window


def test_linear_trend_continues_a_straight_line_and_never_goes_below_zero() -> None:
    assert fc.predict("linear_trend", RISING, 2)[0] == pytest.approx([34.0, 36.0])
    falling = fc.predict("linear_trend", [30.0, 20.0, 10.0, 5.0, 2.0], 4)[0]
    assert min(falling) == 0.0 and all(v >= 0 for v in falling)


def test_an_unknown_method_is_an_error() -> None:
    with pytest.raises(ValueError):
        fc.predict("prophet", FLAT, 1)


# ---------- backtest and the choice

def test_backtest_is_exact_on_a_flat_series_and_the_trend_wins_on_a_line() -> None:
    assert fc.backtest(FLAT, "moving_average")["wape"] == 0.0
    scores = {m: fc.backtest(RISING, m) for m in fc.METHODS}
    assert scores["linear_trend"]["wape"] == pytest.approx(0.0, abs=1e-9)
    assert fc.choose(scores) == "linear_trend"


def test_a_tie_goes_to_the_simplest_method() -> None:
    assert fc.choose({m: fc.backtest(FLAT, m) for m in fc.METHODS}) == "moving_average"


def test_wape_is_none_when_nothing_was_ordered_and_the_choice_still_works() -> None:
    zeros = [0.0] * 12
    scores = {m: fc.backtest(zeros, m) for m in fc.METHODS}
    assert all(s["wape"] is None for s in scores.values()) and fc.choose(scores) == "moving_average"


def test_wape_and_mae_are_computed_on_the_last_six_months_only() -> None:
    y = [100.0, 0.0] * 3 + [10.0] * 6  # wild swings long ago must not count against a method that now fits
    r = fc.backtest(y, "naive")
    assert r["mae"] == pytest.approx(10 / 6) and r["wape"] == pytest.approx(10 / 60)  # one miss of 10 (month 7) inside the window of 6


# ---------- inventory

@pytest.mark.parametrize(("service", "z"), [(0.8, 0.8416), (0.9, 1.2816), (0.95, 1.6449)])
def test_inventory_is_the_forecast_plus_safety_stock(service: float, z: float) -> None:
    pts = [{"mid": 25.0}] * 4
    inv = fc.inventory(pts, 10.0, service)
    assert inv["planned"] == 100.0 and inv["safety"] == pytest.approx(z * 10 * 2) and inv["total"] == math.ceil(100 + z * 20)


# ---------- the data

def sql_total(metric: str, where: str = "true") -> dict[str, float]:
    expr = "count(*)" if metric == "orders" else "sum(quantity)"
    with engine.connect() as con:
        return {r[0]: float(r[1]) for r in con.execute(text(f"SELECT to_char(order_date,'YYYY-MM'), {expr} FROM orders WHERE {where} GROUP BY 1"))}


@pytest.mark.parametrize("metric", ["orders", "units"])
def test_the_series_matches_the_database(metric: str) -> None:
    got = dict(zip([f"2025-{m:02d}" for m in range(1, 13)], fc.series(ALL, metric)))
    assert got == {k: sql_total(metric).get(k, 0.0) for k in got}


def test_a_category_series_and_the_dimension_filters_apply_but_not_the_date() -> None:
    paper = fc.series(ALL, "units", "PAPER")
    assert sum(paper) == sum(sql_total("units", "product_category = 'PAPER'").values())
    ups = fc.series(af.Filters(carrier=("UPS",)), "orders")
    assert sum(ups) == 88
    assert fc.series(af.build_filters({"start": "2025-10-01"}), "orders") == fc.series(ALL, "orders")  # the date filter is ignored


# ---------- the forecast

def test_the_forecast_shape_for_orders_and_units() -> None:
    o = fc.forecast(ALL, "orders", 4)
    assert len(o["points"]) == 4 and [p["ym"] for p in o["points"]] == ["2026-01", "2026-02", "2026-03", "2026-04"]
    assert o["method"] in fc.METHODS and {m["name"] for m in o["methods"]} == set(fc.METHODS) and o["inventory"] is None and o["basis"] is None
    u = fc.forecast(ALL, "units", 3, service=0.95)
    assert u["inventory"]["service"] == 0.95 and u["inventory"]["total"] >= u["inventory"]["planned"]
    assert u["inventory"]["planned"] == pytest.approx(sum(p["mid"] for p in u["points"]))


def test_the_range_widens_with_the_horizon_and_never_goes_below_zero() -> None:
    pts = fc.forecast(ALL, "orders", 6)["points"]
    widths = [p["hi"] - p["lo"] for p in pts]
    assert all(p["lo"] >= 0 and p["lo"] <= p["mid"] <= p["hi"] for p in pts)
    assert widths[-1] > widths[0]


def test_the_chosen_method_is_the_one_with_the_lowest_backtest_error() -> None:
    r = fc.forecast(ALL, "units", 3)
    best = min((m for m in r["methods"] if m["wape"] is not None), key=lambda m: (m["wape"], fc.METHODS.index(m["name"])))
    assert r["method"] == best["name"]


def test_a_sku_is_its_category_forecast_times_its_share() -> None:
    sku = "CRAYON-0017"
    r, cat = fc.forecast(ALL, "units", 4, sku=sku.lower()), fc.forecast(ALL, "units", 4, category="CRAYON")
    b = r["basis"]
    assert b["sku"] == sku and b["category"] == "CRAYON" and b["share"] == pytest.approx(b["sku_total"] / b["category_total"]) and b["sku_total"] == 6
    assert [p["mid"] for p in r["points"]] == pytest.approx([p["mid"] * b["share"] for p in cat["points"]])
    assert sum(r["history"]) == 6 and r["method"] == cat["method"]  # judged on the category, shown with the SKU's own history


@pytest.mark.parametrize("bad", [
    {"metric": "revenue"}, {"horizon": 0}, {"horizon": 7}, {"category": "NOPE"}, {"sku": "NOPE-0001"},
    {"sku": "CRAYON-0017", "category": "PAPER"}, {"service": 0.5}, {"category": "x' OR '1'='1"},
])
def test_what_the_data_cannot_answer_is_refused(bad: dict) -> None:
    with pytest.raises(ValueError):
        fc.forecast(ALL, **bad)


# ---------- the API

def test_the_endpoint_keeps_the_old_fields_and_adds_the_new_ones(client: TestClient) -> None:
    d = client.get("/api/forecast", params={"horizon": 3}).json()
    assert len(d["history"]) == 12 and d["history_start"] == "2025-01" and len(d["points"]) == 3
    assert d["metric"] == "orders" and d["inventory"] is None and d["method"] in fc.METHODS
    u = client.get("/api/forecast", params={"metric": "units", "category": "PAPER", "horizon": 4, "service": 0.8}).json()
    assert u["category"] == "PAPER" and len(u["points"]) == 4 and u["inventory"]["service"] == 0.8
    assert client.get("/api/forecast", params={"sku": "CRAYON-0017", "metric": "units"}).json()["basis"]["category"] == "CRAYON"


@pytest.mark.parametrize("params", [
    {"metric": "x"}, {"horizon": 0}, {"horizon": 7}, {"category": "NOPE"}, {"sku": "NOPE-1"}, {"service": 0.5}, {"carrier": "Nope"},
])
def test_the_endpoint_refuses_what_it_cannot_forecast(client: TestClient, params: dict) -> None:
    assert client.get("/api/forecast", params=params).status_code == 422


def test_the_meta_lists_the_categories(client: TestClient) -> None:
    assert client.get("/api/meta").json()["categories"] == af.all_categories() and len(af.all_categories()) == 8


# ---------- the Copilot tool

def run_tool(**args: object) -> tuple[turn_mod.Turn, dict]:
    t = turn_mod.Turn(f=ALL, compare="prev")
    return t, json.loads(tools.make_tools(t)["forecast_demand"].invoke(args))


def test_the_tool_draws_the_chart_and_records_the_maths() -> None:
    t, out = run_tool(metric="units", horizon=4, category="PAPER", title="Unit PAPER")
    assert out["shown_to_user"] and len(out["forecast"]) == 4 and out["inventory"]["service"] == 0.9
    ch = t.chart
    assert ch["type"] == "line" and ch["title"] == "Unit PAPER" and ch["y"] == ["actual", "forecast", "low", "high"] and len(ch["rows"]) == 12 + 4
    assert ch["rows"][0]["actual"] == 69 and ch["rows"][11]["forecast"] == ch["rows"][11]["actual"]  # the lines meet at the last actual month
    assert ch["rows"][12]["actual"] is None and ch["rows"][12]["low"] <= ch["rows"][12]["forecast"] <= ch["rows"][12]["high"]
    formulas = t.calc()["formulas"]
    assert formulas[0].startswith("WAPE =") and any("Method:" in f for f in formulas) and any(f.startswith("inventory =") for f in formulas)


def test_the_tool_explains_a_sku_estimate_and_skips_inventory_for_orders() -> None:
    t, out = run_tool(metric="units", sku="CRAYON-0017", horizon=4)
    assert out["sku_basis"]["category"] == "CRAYON" and any(f.startswith("SKU forecast =") for f in t.calc()["formulas"])
    _, orders = run_tool(metric="orders", horizon=3)
    assert orders["inventory"] is None


def test_the_tool_answers_with_an_error_instead_of_failing() -> None:
    t, out = run_tool(sku="NOPE-9")
    assert "no SKU" in out["error"] and t.chart is None and t.queries == []
    assert "error" in run_tool(horizon=9)[1]


def test_the_forecaster_is_told_to_use_only_the_tool() -> None:
    from app.modules.ai.agents.context import Ctx

    p = forecaster.prompt(Ctx(ALL, "prev", "en"))
    assert "forecast_demand" in p and "Never estimate" in p and "SKU" in p and "not an order quantity" in p


def test_the_tool_can_forecast_one_carrier_without_changing_the_dashboard() -> None:
    t, out = run_tool(metric="orders", horizon=3, carrier=["UPS"])
    assert out["filters"]["carrier"] == ["UPS"] and sum(out["last_12_months"]) == 88
    assert t.f == ALL  # the view the user is looking at did not move
    calc = t.calc()
    assert calc["filters"]["carrier"] == ["UPS"] and calc["rows"] == 88  # "how the AI calculated this" shows what was really used


def test_named_dimensions_replace_the_view_and_a_bad_one_is_an_error() -> None:
    t = turn_mod.Turn(f=af.Filters(region=("EU",), exclude=("region",)), compare="prev")
    out = json.loads(tools.make_tools(t)["forecast_demand"].invoke({"metric": "orders", "region": ["UK"]}))
    assert out["filters"]["region"] == ["UK"] and out["filters"]["exclude"] == []  # the view's "all except EU" is replaced, not combined
    assert "invalid carrier" in json.loads(tools.make_tools(t)["forecast_demand"].invoke({"carrier": ["Nope"]}))["error"]


def test_without_named_dimensions_the_dashboard_filters_apply() -> None:
    t = turn_mod.Turn(f=af.Filters(carrier=("FedEx",)), compare="prev")
    out = json.loads(tools.make_tools(t)["forecast_demand"].invoke({"metric": "orders"}))
    assert out["filters"]["carrier"] == ["FedEx"]


def test_every_method_carries_its_own_forecast_range_and_inventory() -> None:
    r = fc.forecast(ALL, "units", 4)
    assert [m["name"] for m in r["methods"]] == list(fc.METHODS)
    for m in r["methods"]:
        assert len(m["points"]) == 4 and all(p["lo"] <= p["mid"] <= p["hi"] and p["lo"] >= 0 for p in m["points"])
        assert m["inventory"]["total"] >= m["inventory"]["planned"] and m["params"] is not None
    best = next(m for m in r["methods"] if m["name"] == r["method"])
    assert (r["points"], r["params"], r["inventory"], r["sd"]) == (best["points"], best["params"], best["inventory"], best["sd"])  # the top level is the winner's


def test_choosing_another_method_changes_the_forecast() -> None:
    by = {m["name"]: m for m in fc.forecast(ALL, "orders", 3)["methods"]}
    assert [p["mid"] for p in by["linear_trend"]["points"]] != [p["mid"] for p in by["moving_average"]["points"]]
    assert by["moving_average"]["inventory"] is None  # orders have no inventory


def test_a_sku_estimate_is_scaled_for_every_method() -> None:
    r, cat = fc.forecast(ALL, "units", 3, sku="CRAYON-0017"), fc.forecast(ALL, "units", 3, category="CRAYON")
    share = r["basis"]["share"]
    for mine, theirs in zip(r["methods"], cat["methods"]):
        assert [p["mid"] for p in mine["points"]] == pytest.approx([p["mid"] * share for p in theirs["points"]])
