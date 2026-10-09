"""Numeric range filters (order value, quantity, lead time, order age) and the arrival-date range."""
import pytest
from fastapi.testclient import TestClient

from app.db.engine import query
from app.modules.analytics import filters as af


def count(f: af.Filters) -> int:
    return query(f"SELECT count(*) AS n FROM orders WHERE {af.where(f)}")[0]["n"]


def sql(where: str) -> int:
    return query(f"SELECT count(*) AS n FROM orders WHERE {where}")[0]["n"]


def make(**values: object) -> af.Filters:
    return af.build_filters(values)


# ---------- the SQL

def test_where_for_each_bound() -> None:
    assert af.where(make(value_min=10)) == "order_value_usd >= 10"
    assert af.where(make(value_max=99.5)) == "order_value_usd <= 99.5"
    assert af.where(make(quantity_min=2, quantity_max=5)) == "quantity >= 2\n  AND quantity <= 5"
    assert af.where(make(lead_max=7)) == "lead_days <= 7" and af.where(make(age_min=30)) == "age_days >= 30"
    assert af.where(make(arrived_start="2025-10-01", arrived_end="2025-12-31")) == "delivery_date >= DATE '2025-10-01'\n  AND delivery_date <= DATE '2025-12-31'"


@pytest.mark.parametrize(("values", "where"), [
    ({"value_min": 100}, "order_value_usd >= 100"),
    ({"value_max": 20}, "order_value_usd <= 20"),
    ({"value_min": 20, "value_max": 100}, "order_value_usd >= 20 AND order_value_usd <= 100"),
    ({"quantity_min": 5}, "quantity >= 5"),
    ({"lead_min": 3, "lead_max": 7}, "lead_days >= 3 AND lead_days <= 7"),
    ({"age_min": 60}, "age_days >= 60"),
    ({"arrived_start": "2025-06-01", "arrived_end": "2025-06-30"}, "delivery_date >= DATE '2025-06-01' AND delivery_date <= DATE '2025-06-30'"),
])
def test_a_range_counts_what_the_database_counts(values: dict, where: str) -> None:
    assert count(make(**values)) == sql(where) and 0 < sql(where) < 400


def test_bounds_are_inclusive() -> None:
    n = sql("quantity = 3")
    assert n > 0 and count(make(quantity_min=3, quantity_max=3)) == n


def test_an_order_without_a_lead_time_never_passes_a_lead_bound() -> None:
    arrived = sql("lead_days IS NOT NULL")
    assert arrived == 370 and count(make(lead_min=0)) == arrived  # even a bound that excludes nothing leaves out the 30 not arrived
    assert count(make(arrived_start="2025-01-01")) == sql("delivery_date IS NOT NULL")


def test_ranges_combine_with_values_and_each_other() -> None:
    f = make(carrier=["UPS"], value_min=50, quantity_max=4)
    assert count(f) == sql("carrier = 'UPS' AND order_value_usd >= 50 AND quantity <= 4")


# ---------- validation

@pytest.mark.parametrize("values", [
    {"value_min": 50, "value_max": 10},
    {"lead_min": "abc"}, {"value_max": "nan"}, {"quantity_min": "inf"}, {"age_max": "-inf"}, {"value_min": 1e12},
    {"value_min": "1; DROP TABLE orders"}, {"quantity_max": "5 OR 1=1"},
    {"arrived_start": "2025-13-01"}, {"arrived_end": "tomorrow"}, {"arrived_start": "2025-05-01", "arrived_end": "2025-04-01"},
    {"ranges": {"price": [1, 2]}}, {"ranges": {"value": [1]}}, {"ranges": {"value": "1-2"}}, {"ranges": ["value"]},
])
def test_bad_ranges_are_refused(values: dict) -> None:
    with pytest.raises(ValueError):
        make(**values)


def test_an_empty_range_is_no_range() -> None:
    assert make(value_min="", value_max=None, lead_min=None) == af.Filters()
    assert not af.Filters().ranges and not af.Filters().has_dims()


def test_equal_filters_compare_equal_whatever_the_shape_or_type() -> None:
    assert make(value_min=10) == make(value_min="10") == make(ranges={"value": [10.0, None]}) == af.Filters(ranges=(("value", 10, None),))
    assert make(value_min=10, lead_max=5).ranges == (("lead", None, 5.0), ("value", 10.0, None))  # sorted by name


def test_the_dict_a_filter_makes_builds_the_same_filter_again() -> None:
    f = make(carrier=["UPS"], value_min=12.5, value_max=80, lead_max=7, arrived_start="2025-03-01", arrived_end="2025-03-31", start="2025-01-01")
    d = f.as_dict()
    assert d["ranges"] == {"lead": [None, 7.0], "value": [12.5, 80.0]} and d["arrived_start"] == "2025-03-01"
    assert af.build_filters(d) == f
    assert af.build_filters({**d, "ranges": {}}).ranges == ()  # an empty ranges object means no ranges


def test_the_comparison_against_all_data_clears_the_ranges_too() -> None:
    f = make(carrier=["UPS"], value_min=50, arrived_start="2025-03-01")
    assert af.without_dims(f) == af.Filters() and f.has_dims()


def test_the_slug_names_the_ranges() -> None:
    assert make(value_min=10, value_max=50).slug() == "value10-50"
    assert make(lead_max=7, arrived_start="2025-03-01").slug() == "lead-7_arrived2025-03-01-"
    assert make(carrier=["UPS"], quantity_min=2.5).slug() == "UPS_quantity2.5-"


# ---------- the API

def test_the_query_string_takes_ranges(client: TestClient) -> None:
    r = client.get("/api/overview", params={"value_min": 50, "value_max": 200, "lead_max": 7, "arrived_start": "2025-02-01"})
    assert r.status_code == 200
    assert r.json()["stats"]["n"] == count(make(value_min=50, value_max=200, lead_max=7, arrived_start="2025-02-01"))
    for bad in ({"value_min": "x"}, {"lead_min": 9, "lead_max": 2}, {"arrived_end": "never"}, {"age_min": "1;2"}):
        assert client.get("/api/overview", params=bad).status_code == 422


def test_facets_report_the_bounds_for_the_placeholders(client: TestClient) -> None:
    d = client.get("/api/facets").json()["ranges"]
    assert d["value"] == {"min": 2.05, "max": 298.87} and d["quantity"] == {"min": 1, "max": 18} and d["lead"] == {"min": 1, "max": 12}
    assert d["arrived"] == {"min": "2025-01-02", "max": "2025-12-31"} and d["age"]["min"] >= 0


def test_ranges_survive_presets_and_schedules(client: TestClient) -> None:
    pid = client.post("/api/presets", json={"name": "big", "filters": {"value_min": 100, "arrived_start": "2025-03-01"}}).json()["id"]
    [p] = client.get("/api/presets").json()
    assert p["id"] == pid and p["filters"]["ranges"] == {"value": [100.0, None]} and p["filters"]["arrived_start"] == "2025-03-01"
    body = {"frequency": "weekly", "recipients": ["ops@spaceship.test"], "contents": ["csv"], "filters": {"ranges": {"lead": [None, 7]}}}
    assert client.post("/api/schedules", json=body).status_code == 200
    assert client.get("/api/schedules").json()[0]["filters"]["ranges"] == {"lead": [None, 7.0]}


def test_the_csv_export_follows_a_range(client: TestClient) -> None:
    r = client.get("/api/export.csv", params={"quantity_min": 10})
    assert r.status_code == 200 and len(r.text.strip().splitlines()) - 1 == sql("quantity >= 10")


def test_old_filters_without_the_new_keys_still_build() -> None:
    assert af.build_filters({"period": "Q4", "carrier": "UPS"}).ranges == ()
    assert af.build_filters({"carrier": ["UPS"], "exclude": []}) == af.Filters(carrier=("UPS",))
    assert af.build_filters({"start": "2025-01-01"}).arrived_start is None
