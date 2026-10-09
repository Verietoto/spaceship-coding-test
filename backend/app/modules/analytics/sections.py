"""One function per dashboard section (plus whole-data views), each returning that section's JSON."""
from dataclasses import replace
from datetime import date

from ...db.engine import query
from .filters import DIM_COLS, Filters, data_ranges, all_warehouses, allowed_values, data_bounds, data_years, where, without_dims
from .models import CSV_COLUMNS
from .metrics import OPEN, PROBLEM, STUCK, calc, comparison, stats, stats_by


def trend_window(f: Filters) -> tuple[date, date]:
    """The trend shows whole calendar years around the selected range; bars outside the range are dimmed by the UI."""
    lo, hi = data_bounds()
    return date((f.start or lo).year, 1, 1), date((f.end or hi).year, 12, 31)


def overview(f: Filters, compare: str, gran: str) -> dict:
    w_lo, w_hi = trend_window(f)
    bucket = "to_char(order_date, 'YYYY-MM')" if gran == "month" else "to_char(order_date, 'YYYY\"-Q\"Q')"
    trend_sql = (
        f"SELECT {bucket} AS g, count(*) AS n, avg(CASE WHEN status = 'delayed' THEN 100.0 ELSE 0 END) AS delay\n"
        f"FROM orders\nWHERE order_date BETWEEN DATE '{w_lo}' AND DATE '{w_hi}' AND "
        "{w}\nGROUP BY g ORDER BY g"
    )
    trend = query(trend_sql.format(w=where(f, period=False)))
    trend_base = query(trend_sql.format(w=where(without_dims(f), period=False))) if compare == "base" and f.has_dims() else None
    hist = query(
        "SELECT least(greatest(lead_days, 2), 9) AS bin, count(*) AS n\n"
        f"FROM orders\nWHERE lead_days IS NOT NULL AND {where(f)}\nGROUP BY bin ORDER BY bin"
    )
    return {
        "stats": stats(f),
        "compare": comparison(f, compare),
        "trend": trend,
        "trend_base": trend_base,
        "window": {"start": w_lo.isoformat(), "end": w_hi.isoformat()},
        "hist": hist,  # bin 2 = "<=2 days", 9 = "9+ days"
        "calc": calc(f, ["orders", "value", "delivered", "delay", "p90", "over7"]),
    }


def delivery(f: Filters) -> dict:
    heat = query(
        "SELECT carrier, region, count(*) AS n, avg(CASE WHEN status = 'delayed' THEN 100.0 ELSE 0 END) AS delay\n"
        f"FROM orders\nWHERE {where(f, skip=('carrier', 'region'))}\nGROUP BY carrier, region"
    )
    warehouses = stats_by(f, "warehouse", skip=("warehouse", "region"))
    for w in warehouses:
        w["region"] = all_warehouses()[w["key"]]
    return {
        "carriers": stats_by(f, "carrier", skip=("carrier",)),
        "heat": heat,
        "warehouses": warehouses,
        "calc": calc(f, ["orders", "delay", "p90", "over7"]),
    }


def clients(f: Filters) -> dict:
    rows = stats_by(f, "client_id", skip=("client",))
    total = sum(r["val"] for r in rows)
    top5 = sorted(rows, key=lambda r: -r["val"])[:5]
    return {
        "clients": rows,
        "top5_share": sum(r["val"] for r in top5) / total * 100 if total else None,
        "top5": [r["key"] for r in top5],
        "flagged": [r["key"] for r in rows if r["n"] >= 8 and r["delay"] > 20],
        "at_risk_value": sum(r["prob_val"] for r in rows),
        "total_value": total,
        "calc": calc(replace(f, client=()), ["orders", "value", "delay", "atrisk"]),
    }


def risk(f: Filters, include_delayed: bool, sort: str) -> dict:
    cond = PROBLEM if include_delayed else OPEN
    order = {
        "age": "days DESC",
        "value": "order_value_usd DESC",
    }.get(sort, "client_value DESC, order_value_usd DESC")  # impact: client's total value, then order value
    rows = query(
        "WITH cv AS (SELECT client_id, sum(order_value_usd) AS client_value FROM orders GROUP BY client_id)\n"
        "SELECT order_id, o.client_id, carrier, warehouse, region, status, origin_city, destination_city,\n"
        "       order_value_usd, lead_days, age_days, client_value,\n"
        "       CASE WHEN status = 'in_transit' THEN age_days ELSE coalesce(lead_days, 0) END AS days\n"
        f"FROM orders o JOIN cv USING (client_id)\nWHERE {cond} AND {where(f)}\nORDER BY {order}, order_id"
    )
    carrier_lead = {
        r["carrier"]: {"mean": r["mean"], "n": r["n"]}
        for r in query("SELECT carrier, avg(lead_days) AS mean, count(lead_days) AS n FROM orders GROUP BY carrier")
    }
    total_value = query("SELECT sum(order_value_usd) AS v FROM orders")[0]["v"]
    return {
        "orders": rows,
        "carrier_lead": carrier_lead,
        "total_value": total_value,
        "calc": calc(f, ["stuck", "exc", "atrisk"]),
    }


# ---------- whole-data views (not filtered)


def quality() -> dict:
    q = query(
        f"""SELECT count(*) FILTER (WHERE {STUCK}) AS stuck,
                   count(*) FILTER (WHERE status = 'in_transit') AS in_transit,
                   count(DISTINCT client_id) FILTER (WHERE {STUCK}) AS stuck_clients,
                   coalesce(sum(order_value_usd) FILTER (WHERE {STUCK}), 0) AS stuck_value,
                   count(*) FILTER (WHERE is_promo = 1) AS promo,
                   coalesce(sum(order_value_usd) FILTER (WHERE is_promo = 1), 0) AS promo_value,
                   coalesce(sum(order_value_usd * promo_discount_pct / 100.0) FILTER (WHERE is_promo = 1), 0) AS promo_discount,
                   sum(order_value_usd) AS total_value
            FROM orders"""
    )[0]
    q["missing_columns"] = ["eta / sla", "shipping_cost"]
    return q


def export_rows(f: Filters) -> list[dict]:
    return query(
        f"SELECT {', '.join(CSV_COLUMNS)} FROM orders\n"
        f"WHERE {where(f)}\nORDER BY order_date, order_id"
    )


def facets(f: Filters) -> dict:
    """Option lists for the filter bar: each value with its order count under every OTHER active filter."""
    allowed = allowed_values()
    out: dict = {"total": query(f"SELECT count(*) AS n FROM orders WHERE {where(f)}")[0]["n"]}
    for dim, col in DIM_COLS.items():
        counts = {r["v"]: r["n"] for r in query(f"SELECT {col}::text AS v, count(*) AS n FROM orders WHERE {where(f, skip=(dim,))} GROUP BY 1")}
        out[dim] = [{"value": v, "n": counts.get(v, 0), **({"region": all_warehouses()[v]} if dim == "warehouse" else {})} for v in allowed[dim]]
    lo, hi = data_bounds()
    return {**out, "bounds": {"min": lo.isoformat(), "max": hi.isoformat()}, "years": data_years(), "ranges": data_ranges()}
