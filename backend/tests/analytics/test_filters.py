"""Multi-value, exclude and date-range filters, the previous-period rule, and the facets endpoint."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.db.engine import query
from app.modules.analytics import filters as af
from app.modules.analytics import metrics as am


def count(f: af.Filters) -> int:
    return query(f"SELECT count(*) AS n FROM orders WHERE {af.where(f)}")[0]["n"]


def test_where_for_one_many_exclude_and_range() -> None:
    assert af.where(af.Filters()) == "TRUE"
    assert af.where(af.Filters(carrier=("UPS",))) == "carrier = 'UPS'"
    assert af.where(af.Filters(carrier=("UPS",), exclude=("carrier",))) == "carrier <> 'UPS'"
    assert af.where(af.Filters(carrier=("FedEx", "UPS"))) == "carrier IN ('FedEx', 'UPS')"
    assert af.where(af.Filters(region=("EU", "UK"), exclude=("region",))) == "region NOT IN ('EU', 'UK')"
    r = af.where(af.Filters(start=date(2025, 10, 1), end=date(2025, 12, 31)))
    assert r == "order_date >= DATE '2025-10-01'\n  AND order_date <= DATE '2025-12-31'"


def test_counts_add_up() -> None:
    total = count(af.Filters())
    ups, fedex = count(af.Filters(carrier=("UPS",))), count(af.Filters(carrier=("FedEx",)))
    assert count(af.Filters(carrier=("UPS", "FedEx"))) == ups + fedex
    assert count(af.Filters(carrier=("UPS",), exclude=("carrier",))) == total - ups
    q4 = count(af.build_filters({"period": "Q4"}))
    assert q4 < total
    assert count(af.Filters(start=date(2025, 10, 1), end=date(2025, 12, 31))) == q4  # a typed range equals the preset


def test_filters_are_normalised() -> None:
    a = af.Filters(carrier=("UPS", "FedEx", "UPS"), exclude=("carrier", "client"))  # client has no values: dropped
    b = af.Filters(carrier=("FedEx", "UPS"), exclude=("carrier",))
    assert a == b and a.as_dict()["carrier"] == ["FedEx", "UPS"]


@pytest.mark.parametrize(
    "values",
    [
        {"carrier": ["UPS", "x' OR 1=1 --"]},
        {"region": "Atlantis"},
        {"client": ["CL-9999"]},
        {"start": "2025-13-01"},
        {"end": "yesterday"},
        {"start": "2025-05-01", "end": "2025-04-01"},
        {"period": "Q5"},
        {"exclude": ["carrier; DROP TABLE orders"]},
    ],
)
def test_invalid_input_is_rejected(values: dict) -> None:
    with pytest.raises(ValueError):
        af.build_filters(values)


def test_invalid_query_is_422(client: TestClient) -> None:
    assert client.get("/api/overview", params=[("carrier", "UPS"), ("carrier", "Nope")]).status_code == 422
    assert client.get("/api/overview", params={"start": "31/12/2025"}).status_code == 422
    assert client.get("/api/overview", params={"exclude": "bogus"}).status_code == 422


def test_old_and_new_query_forms_agree(client: TestClient) -> None:
    old = client.get("/api/overview", params={"period": "Q4", "carrier": "UPS"}).json()["stats"]
    new = client.get("/api/overview", params={"start": "2025-10-01", "end": "2025-12-31", "carrier": "UPS"}).json()["stats"]
    assert old == new and old["n"] == 15
    two = client.get("/api/overview", params=[("carrier", "UPS"), ("carrier", "FedEx")]).json()["stats"]["n"]
    assert two == 88 + 89
    rest = client.get("/api/overview", params=[("carrier", "UPS"), ("exclude", "carrier")]).json()["stats"]["n"]
    assert rest == 400 - 88


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    [
        ("2025-10-01", "2025-12-31", ("2025-07-01", "2025-09-30")),  # quarter -> previous quarter
        ("2025-07-01", "2025-12-31", ("2025-01-01", "2025-06-30")),  # H2 -> H1
        ("2025-03-01", "2025-03-31", ("2025-02-01", "2025-02-28")),  # month -> previous month
        ("2025-03-10", "2025-03-19", ("2025-02-28", "2025-03-09")),  # 10 days -> the 10 days before
        ("2025-01-01", "2025-03-31", None),  # Q1: nothing before the data
        ("2025-01-01", "2025-12-31", None),  # whole year: nothing before the data
        (None, None, None),
    ],
)
def test_previous_period(start: str | None, end: str | None, expected: tuple[str, str] | None) -> None:
    f = af.Filters(start=date.fromisoformat(start) if start else None, end=date.fromisoformat(end) if end else None)
    got = af.prev_range(f)
    assert (got and (got[0].isoformat(), got[1].isoformat())) == expected


def test_comparison_uses_previous_period() -> None:
    f = af.build_filters({"period": "Q4"})
    cmp = am.comparison(f, "prev")
    assert cmp["range"] == {"start": "2025-07-01", "end": "2025-09-30"}
    assert cmp["stats"]["n"] == am.stats(af.build_filters({"period": "Q3"}))["n"]
    assert am.comparison(af.build_filters({"period": "FY"}), "prev")["stats"] is None


def test_facets_count_under_the_other_filters(client: TestClient) -> None:
    d = client.get("/api/facets", params={"carrier": "UPS"}).json()
    assert d["total"] == 88
    regions = {r["value"]: r["n"] for r in d["region"]}
    assert sum(regions.values()) == 88  # a dimension's counts add up to the total of the OTHER filters
    carriers = {c["value"]: c["n"] for c in d["carrier"]}
    assert carriers["UPS"] == 88 and sum(carriers.values()) == 400  # its own filter is ignored for its own counts
    assert all("region" in w for w in d["warehouse"])
    assert d["bounds"] == {"min": "2025-01-01", "max": "2025-12-30"} and d["years"] == [2025]
    zero = client.get("/api/facets", params=[("region", "EU")]).json()
    assert any(w["n"] == 0 for w in zero["warehouse"])  # warehouses outside EU are listed with 0


def test_trend_covers_whole_years_and_dims_outside_range(client: TestClient) -> None:
    d = client.get("/api/overview", params={"period": "Q4"}).json()
    assert d["window"] == {"start": "2025-01-01", "end": "2025-12-31"}
    assert [r["g"] for r in d["trend"]][:2] == ["2025-01", "2025-02"]
    q = client.get("/api/overview", params={"gran": "quarter"}).json()
    assert [r["g"] for r in q["trend"]] == ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"]


def test_forecast_covers_every_month_of_the_data(client: TestClient) -> None:
    d = client.get("/api/forecast", params={"carrier": "UPS", "start": "2025-10-01"}).json()
    assert len(d["history"]) == 12 and d["history_start"] == "2025-01"  # the date filter doesn't cut the series


def test_comparison_falls_back_to_all_data_when_no_previous_period() -> None:
    f = af.Filters(carrier=("UPS",))  # no date range: there is no "previous period"
    cmp = am.comparison(f, "prev")
    assert cmp["mode"] == "base" and cmp["stats"]["n"] == 400
    q1 = af.build_filters({"period": "Q1", "carrier": "UPS"})  # nothing before the data starts
    assert am.comparison(q1, "prev")["mode"] == "base"
    assert am.comparison(af.Filters(), "prev")["stats"] is None  # no filters at all: nothing sensible to compare with


# ---------- the six value filters added after region/warehouse/carrier/client

NEW = {  # dimension -> (column, a value the data has, how many orders it has)
    "category": ("product_category", "CRAYON", 69),
    "status": ("status", "delayed", 55),
    "promo": ("is_promo", "1", 22),
    "origin": ("origin_city", "London, UK", 54),
    "destination": ("destination_city", "Leeds, UK", 15),
    "sku": ("sku", "CRAYON-0017", 3),
}


@pytest.mark.parametrize("dim", NEW)
def test_a_new_dimension_filters_and_excludes(dim: str) -> None:
    col, value, n = NEW[dim]
    total = count(af.Filters())
    assert count(af.Filters(**{dim: (value,)})) == n
    assert count(af.Filters(**{dim: (value,), "exclude": (dim,)})) == total - n
    assert af.build_filters({dim: [value]}) == af.Filters(**{dim: (value,)})  # the same shape from a request
    assert af.where(af.Filters(**{dim: (value,)})) == f"{col} = '{value}'"


@pytest.mark.parametrize("dim", NEW)
def test_a_new_dimension_rejects_values_the_data_does_not_have(dim: str) -> None:
    for bad in ("Nope", "x' OR '1'='1", "'; DROP TABLE orders; --"):
        with pytest.raises(ValueError):
            af.build_filters({dim: [bad]})


def test_several_values_across_dimensions_narrow_together() -> None:
    f = af.Filters(category=("CRAYON", "PAPER"), status=("delayed",), promo=("0",))
    direct = query("SELECT count(*) AS n FROM orders WHERE product_category IN ('CRAYON','PAPER') AND status = 'delayed' AND is_promo = 0")[0]["n"]
    assert count(f) == direct and direct < count(af.Filters(status=("delayed",)))


def test_statuses_come_in_the_order_an_order_moves() -> None:
    assert af.all_statuses() == ["delivered", "delayed", "in_transit", "exception", "canceled"]
    assert af.all_promo() == ["0", "1"]


def test_an_apostrophe_in_a_value_cannot_break_the_sql() -> None:
    f = af.Filters(carrier=("UPS",))
    object.__setattr__(f, "carrier", ("O'Hare",))  # a value that passed validation upstream (a city that holds an apostrophe)
    assert af.where(f) == "carrier = 'O''Hare'"


def test_the_query_string_takes_the_new_dimensions(client: TestClient) -> None:
    r = client.get("/api/overview", params={"category": ["CRAYON", "PAPER"], "status": "delayed", "promo": "0", "exclude": "promo"})
    assert r.status_code == 200
    assert client.get("/api/overview", params={"origin": "London, UK"}).status_code == 200
    for bad in ({"category": "Nope"}, {"status": "lost"}, {"promo": "2"}, {"origin": "Mars"}, {"destination": "Atlantis"}, {"sku": "X-1"}):
        assert client.get("/api/overview", params=bad).status_code == 422


def test_facets_count_every_new_dimension_under_the_other_filters(client: TestClient) -> None:
    d = client.get("/api/facets", params={"carrier": "UPS"}).json()
    ups = count(af.Filters(carrier=("UPS",)))
    for dim in NEW:
        assert sum(o["n"] for o in d[dim]) == ups, dim  # each order has exactly one value of the dimension
    assert {o["value"] for o in d["status"]} == set(af.all_statuses()) and {o["value"] for o in d["promo"]} == {"0", "1"}
    assert len(d["sku"]) == 355
    narrowed = client.get("/api/facets", params={"carrier": "UPS", "status": "delayed"}).json()
    assert sum(o["n"] for o in narrowed["status"]) == ups  # a dimension is counted under the OTHER filters, so the others show their options


def test_the_slug_names_the_new_filters() -> None:
    assert af.Filters(category=("PAPER",), status=("delayed",), exclude=("status",)).slug() == "PAPER_not_delayed"
