"""Pins the dashboard's numbers to the ones in the design doc (section 9), so a refactor can't silently change them."""
import pytest

from app.db.engine import query
from app.modules.analytics import filters as af
from app.modules.analytics import forecast as afc
from app.modules.analytics import metrics as am
from app.modules.analytics import sections as asec

ALL = af.Filters()


def by_key(rows: list[dict]) -> dict:
    return {r["key"]: r for r in rows}


def test_headline_kpis() -> None:
    s = am.stats(ALL)
    assert s["n"] == 400
    assert s["deliv"] == pytest.approx(76.0)
    assert s["delay"] == pytest.approx(13.75)
    assert s["lead_n"] == 370
    assert round(s["mean"], 1) == 3.8 and s["p50"] == 4 and s["p90"] == 6
    assert round(s["over7"], 1) == 5.7
    assert (s["stuck"], s["exc"], s["open"]) == (26, 11, 37)
    assert round(s["prob_val"]) == 3101


def test_carriers() -> None:
    c = by_key(am.stats_by(ALL, "carrier"))
    assert round(c["DHL"]["delay"], 1) == 4.8
    assert c["DPD"]["delay"] == 0
    assert round(c["OnTrac"]["p90"], 1) == 7.4
    ups = {r["region"]: round(r["delay"], 1) for r in asec.delivery(ALL)["heat"] if r["carrier"] == "UPS"}
    assert ups["US-E"] == 30.0 and ups["UK"] == 27.8 and ups["EU"] == 4.8


def test_clients() -> None:
    c = asec.clients(ALL)
    assert round(c["top5_share"], 1) == 47.1
    assert len(c["flagged"]) == 6


def test_filters_and_periods() -> None:
    q4_ups = af.build_filters({"period": "Q4", "carrier": "UPS"})
    assert am.stats(q4_ups)["n"] == 15
    with pytest.raises(ValueError):
        af.build_filters({"carrier": "x' OR 1=1 --"})
    with pytest.raises(ValueError):
        af.build_filters({"period": "Q5"})


def test_terms_carry_the_numbers_behind_every_metric() -> None:
    s = am.stats(ALL)
    t = am.terms(s, am.ALL_METRICS)
    assert list(t) == am.ALL_METRICS
    assert t["orders"] == {"n": 400} and t["delay"] == {"num": s["delay_n"], "den": 400, "value": s["delay"]}
    # the math adds up: the numerator over the denominator is the rate the page shows
    for key in ("delivered", "delay", "ontime", "over7"):
        assert abs(t[key]["num"] / t[key]["den"] * 100 - t[key]["value"]) < 1e-9, key
    assert t["p90"]["n"] == s["lead_n"] and t["atrisk"]["n"] == s["prob_n"] and t["atrisk"]["sum"] == s["prob_val"]


def test_the_new_counts_match_direct_queries() -> None:
    s = am.stats(ALL)
    direct = query("SELECT count(*) FILTER (WHERE status = 'delivered') AS d, count(*) FILTER (WHERE lead_days > 7) AS o FROM orders")[0]
    assert (s["deliv_n"], s["over7_n"]) == (direct["d"], direct["o"])


def test_calc_has_terms_for_exactly_the_requested_metrics() -> None:
    c = am.calc(ALL, ["orders", "delay"])
    assert list(c["terms"]) == ["orders", "delay"] and c["rows"] == c["terms"]["orders"]["n"] and "sql" in c  # the SQL stays for audit



def test_ontime_is_delivered_over_delivered_plus_delayed_and_null_without_either() -> None:
    s = am.stats(ALL)
    assert abs(s["ontime"] - 100 * s["deliv_n"] / (s["deliv_n"] + s["delay_n"])) < 1e-9
    assert am.stats(af.build_filters({"status": ["canceled"]}))["ontime"] is None
