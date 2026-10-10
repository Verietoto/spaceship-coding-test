"""Every number on the dashboard, computed in SQL so the query shown to users is the query that ran.

Definitions (same as the prototype):
- stuck   = in_transit and older than 30 days (as of db.engine.AS_OF)
- open    = exception + stuck            ("order bermasalah berjalan")
- problem = delayed + exception + stuck  (its value = "nilai terdampak")
"""
from dataclasses import replace
from datetime import date

from ...db.engine import query
from .filters import Filters, prev_range, total_orders, where, without_dims

STUCK = "status = 'in_transit' AND age_days > 30"
OPEN = f"(status = 'exception' OR ({STUCK}))"
PROBLEM = f"(status = 'delayed' OR {OPEN})"


STATS = f"""count(*) AS n,
       coalesce(sum(order_value_usd), 0) AS val,
       avg(order_value_usd) AS aov,
       avg(CASE WHEN status = 'delivered' THEN 100.0 ELSE 0 END) AS deliv,
       count(*) FILTER (WHERE status = 'delivered') AS deliv_n,
       count(*) FILTER (WHERE status = 'delayed') AS delay_n,
       avg(CASE WHEN status = 'delayed' THEN 100.0 ELSE 0 END) AS delay,
       100.0 * count(*) FILTER (WHERE status = 'delivered') / nullif(count(*) FILTER (WHERE status IN ('delivered', 'delayed')), 0) AS ontime,
       count(lead_days) AS lead_n,
       count(*) FILTER (WHERE lead_days > 7) AS over7_n,
       avg(lead_days) AS mean,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY lead_days) AS p50,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY lead_days) AS p90,
       avg(CASE WHEN lead_days > 7 THEN 100.0 ELSE 0 END) FILTER (WHERE lead_days IS NOT NULL) AS over7,
       count(*) FILTER (WHERE {STUCK}) AS stuck,
       count(*) FILTER (WHERE status = 'exception') AS exc,
       count(*) FILTER (WHERE {OPEN}) AS open,
       count(*) FILTER (WHERE {PROBLEM}) AS prob_n,
       coalesce(sum(order_value_usd) FILTER (WHERE {PROBLEM}), 0) AS prob_val,
       coalesce(sum(order_value_usd) FILTER (WHERE {OPEN}), 0) AS open_val"""

# What the "Cara AI menghitung" panel shows per metric (formulas themselves live in the frontend i18n).
METRIC_SQL = {
    "orders": "COUNT(*) AS orders",
    "value": "SUM(order_value_usd) AS order_value",
    "delivered": "AVG(CASE WHEN status = 'delivered' THEN 1.0 ELSE 0 END) AS delivered_rate",
    "delay": "AVG(CASE WHEN status = 'delayed' THEN 1.0 ELSE 0 END) AS delay_rate",
    "ontime": "100.0 * COUNT(*) FILTER (WHERE status = 'delivered') / NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered', 'delayed')), 0) AS on_time_rate",
    "mean": "AVG(lead_days) AS lead_mean",
    "p90": "PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lead_days) AS lead_p90",
    "over7": "AVG(CASE WHEN lead_days > 7 THEN 1.0 ELSE 0 END) FILTER (WHERE lead_days IS NOT NULL) AS share_over_7d",
    "stuck": f"COUNT(*) FILTER (WHERE {STUCK}) AS stuck_orders",
    "exc": "COUNT(*) FILTER (WHERE status = 'exception') AS exception_orders",
    "atrisk": f"SUM(order_value_usd) FILTER (WHERE {PROBLEM}) AS value_at_risk",
}


ALL_METRICS = ["orders", "value", "delivered", "delay", "ontime", "mean", "p90", "over7", "stuck", "exc", "atrisk"]


def terms(st: dict, metrics: list[str]) -> dict[str, dict]:
    """The numbers behind each metric, from one `stats` row: what the UI turns into "17 / 88 = 19.3%" (the math, not the SQL)."""
    all_terms = {
        "orders": {"n": st["n"]},
        "value": {"sum": st["val"], "n": st["n"], "aov": st["aov"]},
        "delivered": {"num": st["deliv_n"], "den": st["n"], "value": st["deliv"]},
        "delay": {"num": st["delay_n"], "den": st["n"], "value": st["delay"]},
        "ontime": {"num": st["deliv_n"], "den": st["deliv_n"] + st["delay_n"], "value": st["ontime"]},
        "mean": {"value": st["mean"], "n": st["lead_n"], "median": st["p50"], "p90": st["p90"]},
        "p90": {"value": st["p90"], "n": st["lead_n"], "median": st["p50"], "mean": st["mean"]},
        "over7": {"num": st["over7_n"], "den": st["lead_n"], "value": st["over7"]},
        "stuck": {"n": st["stuck"]},
        "exc": {"n": st["exc"]},
        "atrisk": {"sum": st["prob_val"], "n": st["prob_n"]},
    }
    return {k: all_terms[k] for k in metrics}


def stats_sql(f: Filters, skip: tuple[str, ...] = (), period: bool = True) -> str:
    return f"SELECT {STATS}\nFROM orders\nWHERE {where(f, skip, period)}"


def stats_by_sql(f: Filters, col: str, skip: tuple[str, ...] = ()) -> str:
    return f"SELECT {col} AS key, {STATS}\nFROM orders\nWHERE {where(f, skip)}\nGROUP BY {col}\nORDER BY {col}"


def stats(f: Filters, skip: tuple[str, ...] = (), period: bool = True) -> dict:
    return query(stats_sql(f, skip, period))[0]


def stats_by(f: Filters, col: str, skip: tuple[str, ...] = ()) -> list[dict]:
    return query(stats_by_sql(f, col, skip))


def calc(f: Filters, metrics: list[str]) -> dict:
    """The computation trace: filters, rows counted, metric keys with their numbers (`terms`), and the SQL (kept for audit)."""
    sql = "SELECT " + ",\n       ".join(METRIC_SQL[m] for m in metrics) + f"\nFROM orders\nWHERE {where(f)};"
    result = query(sql.rstrip(";"))[0]
    st = stats(f)
    return {"filters": f.as_dict(), "rows": st["n"], "total": total_orders(), "metrics": metrics, "terms": terms(st, metrics), "sql": sql, "result": result}


def comparison(f: Filters, mode: str, cmp_range: tuple[date | None, date | None] = (None, None)) -> dict:
    if mode == "custom":
        # Any other period, same filters. An incomplete or reversed range counts as "not chosen yet".
        lo, hi = cmp_range
        if lo is None or hi is None or lo > hi:
            return {"mode": mode, "range": None, "stats": None}
        return {"mode": mode, "range": {"start": lo.isoformat(), "end": hi.isoformat()}, "stats": stats(replace(f, start=lo, end=hi))}
    if mode == "prev" and not prev_range(f) and f.has_dims():
        # Nothing before the selected period (or no period selected): compare with all data instead of showing nothing.
        return {"mode": "base", "stats": stats(without_dims(f))}
    if mode == "prev":
        r = prev_range(f)
        return {
            "mode": mode,
            "range": {"start": r[0].isoformat(), "end": r[1].isoformat()} if r else None,
            "stats": stats(replace(f, start=r[0], end=r[1])) if r else None,
        }
    if mode == "base" and f.has_dims():
        return {"mode": mode, "stats": stats(without_dims(f))}
    return {"mode": mode, "stats": None}
