"""Per-request state (`Turn`) and the plain functions behind every agent tool.

Tools are closures over one Turn (see tools.py), so whatever a subagent queries, charts or drafts is recorded here and
reaches the API response, even though the coordinator only sees each subagent's final text.
"""
import logging
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from typing import Any

from ....db.readonly import UnsafeSQL, run_readonly
from ...analytics import filters as af
from ...analytics import forecast as afc
from ...analytics import metrics as am
from ...analytics import sections as asec
from ...dashboards.schemas import MAX_SERIES, MAX_WIDGETS
from ...dashboards.service import PLACEHOLDER, clean_filters, default_filters, render_widgets, with_filters
from ...knowledge import service as knowledge
from .widgets import clean_widget, missing_columns

log = logging.getLogger(__name__)

SECTIONS = ["overview", "delivery", "clients", "risk", "forecast", "quality", "reports"]
KPI_GROUPS = {
    "carrier": "carrier", "region": "region", "warehouse": "warehouse", "client": "client_id", "category": "product_category",
    "status": "status", "promo": "is_promo", "origin": "origin_city", "destination": "destination_city",
}


@dataclass
class Turn:
    """What one copilot request changed and computed."""

    f: af.Filters
    compare: str
    section: str | None = None
    changes: list[dict] = field(default_factory=list)
    queries: list[dict] = field(default_factory=list)
    chart: dict | None = None
    dashboard: dict | None = None  # the Builder's draft (in memory only; saving is the user's button)
    route: dict | None = None  # what Jev decided to load, for the audit trail
    user_id: int | None = None  # who is asking; facts are remembered for them
    remembered: list[dict] = field(default_factory=list)
    check_tool: Callable[[str, str], Any] | None = None  # guardrail: (tool, sql) -> a guard.Verdict; None = unguarded
    guards: list[dict] = field(default_factory=list)  # what the tool guardrail decided, for the response
    dashboard_error: str | None = None  # why the last create_dashboard was refused, so a build that ends without a draft can say why
    calc_filters: af.Filters | None = None  # when a tool worked on other filters than the view (a forecast for one carrier), the ones the calc should show

    def calc(self) -> dict | None:
        if not self.queries:
            return None
        return {
            "filters": (self.calc_filters or self.f).as_dict(),
            "rows": am.stats(self.calc_filters or self.f)["n"],
            "total": af.total_orders(),
            "metrics": list(dict.fromkeys(m for q in self.queries for m in q.get("metrics", []))),
            "terms": {k: v for q in self.queries for k, v in q.get("terms", {}).items()},  # the dashboard's own metrics, with their numbers
            "formulas": [x for q in self.queries for x in q["formulas"]],  # math the model wrote for its own queries
            "sql": "\n\n".join(q["sql"].strip().rstrip(";") + ";" for q in self.queries),
        }


def _with_args(base: af.Filters, args: dict, skip: tuple[str, ...] = (), replace_exclude: bool = False) -> af.Filters:
    """`base` with the filter arguments of a tool call applied: lists replace a dimension's values, number bounds replace one bound at a
    time (the other stays), `clear_ranges` removes ranges. `skip`: argument names that mean something else for the tool.
    `replace_exclude`: a dimension named in the call is "these values", whatever the base said about excluding it."""
    values = base.as_dict()
    for key in ("start", "end", "exclude", "arrived_start", "arrived_end", *af.DIMS):
        if key not in skip and args.get(key) is not None:
            values[key] = args[key]
            if replace_exclude and key in af.DIMS and "exclude" not in args:
                values["exclude"] = [d for d in values["exclude"] if d != key]
    ranges = {k: list(v) for k, v in (values.get("ranges") or {}).items()}  # what the base has now, bound by bound
    for key in af.RANGES:
        if args.get(f"{key}_min") is not None or args.get(f"{key}_max") is not None:
            lo, hi = ranges.get(key, [None, None])
            ranges[key] = [args.get(f"{key}_min", lo), args.get(f"{key}_max", hi)]
    for key in args.get("clear_ranges") or []:
        if key == "arrived":
            values["arrived_start"] = values["arrived_end"] = None
        else:
            ranges.pop(key, None)
    values["ranges"] = ranges
    return af.build_filters(values)


def _set_filters(turn: Turn, args: dict) -> dict:
    before = {**turn.f.as_dict(), "compare": turn.compare}
    base = af.Filters() if args.get("reset") else turn.f
    compare = "prev" if args.get("reset") else turn.compare
    try:
        if args.get("period") == "all":
            base = replace(base, start=None, end=None)
        elif args.get("period"):
            base = replace(base, **dict(zip(("start", "end"), af.preset_range(str(args["period"]), int(args.get("year") or af.data_years()[-1])))))
        f = _with_args(base, args)
    except (ValueError, TypeError) as e:
        return {"error": f"invalid filter value: {e}"}
    if args.get("compare") in ("prev", "base", "none"):
        compare = args["compare"]
    turn.f, turn.compare = f, compare
    after = {**f.as_dict(), "compare": compare}
    turn.changes += [{"key": k, "from": before[k], "to": after[k]} for k in after if after[k] != before[k]]
    return {"filters": after, "where": af.where(f), "orders_in_filter": am.stats(f)["n"]}


def _get_kpis(turn: Turn, args: dict) -> dict:
    by = args.get("by")
    wanted = [m for m in args.get("metrics") or [] if m in am.ALL_METRICS] or am.ALL_METRICS  # what the model will report
    if by is None:
        st = am.stats(turn.f)
        turn.queries.append({"sql": am.stats_sql(turn.f), "formulas": [], "metrics": wanted, "terms": am.terms(st, wanted)})
        return {"filters": turn.f.as_dict(), "stats": st}
    if by not in KPI_GROUPS:
        return {"error": f"by must be one of {list(KPI_GROUPS)}"}
    # like the dashboard's rankings: the grouping dimension itself is not narrowed by its own filter
    turn.queries.append({"sql": am.stats_by_sql(turn.f, KPI_GROUPS[by], skip=(by,)), "formulas": [], "metrics": wanted})  # per group: the definitions; the figures are in the answer
    return {"filters": turn.f.as_dict(), "by": by, "rows": am.stats_by(turn.f, KPI_GROUPS[by], skip=(by,))}


def _forecast_formulas(r: dict) -> list[str]:
    """The maths behind a forecast, with the numbers the code computed (definitions first, then this result)."""
    pct = lambda v: "n/a" if v is None else f"{v * 100:.0f}%"  # noqa: E731
    names = {"moving_average": "moving average", "ses": "exponential smoothing", "linear_trend": "linear trend"}
    by = {m["name"]: m["wape"] for m in r["methods"]}
    used = ", ".join(f"{names[n]} {pct(w)}" for n, w in by.items())
    out = ["WAPE = Σ|actual − forecast| ÷ Σ actual", f"Method: {names[r['method']]}, the lowest WAPE on the last 6 months ({used}; same as last month {pct(r['naive']['wape'])})"]
    if r["basis"]:
        b = r["basis"]
        out.append(f"SKU forecast = {b['category']} forecast × SKU share = {sum(p['mid'] for p in r['points']) / b['share'] if b['share'] else 0:.0f} × {b['share'] * 100:.1f}%")
    if r["inventory"]:
        i = r["inventory"]
        out.append(f"inventory = Σ forecast + z × error × √months = {i['planned']:.0f} + {i['z']:.2f} × {r['sd']:.1f} × √{i['months']} = {i['total']}")
    return out


def _forecast_demand(turn: Turn, args: dict) -> dict:
    try:
        # what the user named narrows this forecast only; the dashboard stays as it is. `category` and `sku` are the forecast's own
        # parameters (a SKU is estimated from its category), not filters.
        f = _with_args(turn.f, args, skip=("category", "sku", "start", "end", "exclude"), replace_exclude=True)
        r = afc.forecast(f, str(args.get("metric", "units")), int(args.get("horizon", 3)), args.get("category"), args.get("sku"), int(args.get("service_level", 90)) / 100)
    except (ValueError, TypeError) as e:
        return {"error": str(e)}
    turn.calc_filters = f
    last = len(r["history"]) - 1
    months = [afc.add_months(af.data_bounds()[0].replace(day=1), i).strftime("%Y-%m") for i in range(len(r["history"]))]
    rows: list[dict] = [{"month": m, "actual": round(v, 1), "forecast": round(v, 1) if i == last else None, "low": None, "high": None} for i, (m, v) in enumerate(zip(months, r["history"]))]
    rows += [{"month": p["ym"], "actual": None, "forecast": round(p["mid"], 1), "low": round(p["lo"], 1), "high": round(p["hi"], 1)} for p in r["points"]]
    scope = r["sku"] or r["category"] or "all products"
    turn.chart = {
        "type": "line", "x": "month", "y": ["actual", "forecast", "low", "high"],
        "title": str(args.get("title") or f"{r['metric'].capitalize()} per month, {scope}: actual and forecast")[:120],
        "rows": rows, "sql": "",
    }
    turn.queries.append({"sql": f"-- {r['metric']} per month, {scope}, forecast by {r['method']}", "formulas": _forecast_formulas(r)})
    return {
        "shown_to_user": True, "filters": f.as_dict(), "metric": r["metric"], "scope": scope, "horizon": r["horizon"],
        "method": r["method"], "params": r["params"],
        "forecast": [{"month": p["ym"], "expected": round(p["mid"], 1), "range80": [round(p["lo"], 1), round(p["hi"], 1)]} for p in r["points"]],
        "last_12_months": [round(v, 1) for v in r["history"]],
        "backtest_wape_pct": {m["name"]: None if m["wape"] is None else round(m["wape"] * 100, 1) for m in r["methods"]} | {"same_as_last_month": None if r["naive"]["wape"] is None else round(r["naive"]["wape"] * 100, 1)},
        "sku_basis": r["basis"],
        "inventory": r["inventory"] and {k: round(v, 1) if isinstance(v, float) else v for k, v in r["inventory"].items()},
        "caveat": "12 months of data, no clear seasonality: read as a range.",
    }


def _create_dashboard(turn: Turn, args: dict) -> dict:
    def refuse(message: str) -> dict:
        turn.dashboard_error = message
        return {"error": message}

    asked = args.get("widgets") or []
    if len(asked) > MAX_WIDGETS:  # never cut the list silently: the widget that went missing would be the one just asked for
        return refuse(f"a dashboard holds at most {MAX_WIDGETS} widgets and you passed {len(asked)}: leave out or merge some, and tell the user what you left out")
    widgets = [clean_widget(w) for w in asked]
    if not widgets:
        return refuse("at least one widget is required")
    try:
        filters = clean_filters(args.get("filters") or [])
    except ValueError as e:
        return refuse(f"invalid filters: {e}")
    if filters and not any(PLACEHOLDER in w["sql"] for w in widgets):
        return refuse(f"filters are declared but no widget SQL uses {PLACEHOLDER}: put it in the WHERE clause of the widgets that should follow the filters")
    turn.dashboard_error = None
    applied = default_filters(filters)  # what the widgets are rendered with until the viewer changes a filter
    rendered = render_widgets(widgets, applied)  # runs every widget's SQL through the read-only guard
    turn.dashboard = {
        "title": str(args.get("title", ""))[:120],
        "plan": [str(p) for p in args.get("plan") or []][:6],
        "widgets": rendered,
        "filters": filters,
        "applied": applied.as_dict(),
    }
    for w in rendered:
        if not w.get("error") and (why := missing_columns(w, w["rows"])):
            w["error"] = why  # the same path as a failing SQL: reported back so the agent fixes it
    bad = [{"title": w["title"], "error": w["error"]} for w in rendered if w.get("error")]
    return {"ok": not bad, "widgets": len(rendered), "widgets_with_errors": bad, "hint": "fix the listed widgets and call create_dashboard again" if bad else None}


GUARDED = ("run_sql", "make_chart", "create_dashboard")


def _sql_of(name: str, args: dict) -> str:
    if name == "create_dashboard":
        return "\n-- next widget --\n".join(str(w.get("sql", "")) for w in args.get("widgets") or [])
    return str(args.get("sql", ""))


def run_tool(turn: Turn, name: str, args: dict) -> dict:
    """Every tool call: the guardrail first (SQL tools), then the tool."""
    if turn.check_tool and name in GUARDED:
        verdict = turn.check_tool(name, _sql_of(name, args))
        turn.guards.append(verdict.as_dict())
        if verdict.action == "block":
            log.warning("guardrail blocked %s (%s %s): %s", name, verdict.reason, verdict.scores, " ".join(_sql_of(name, args).split())[:400])
            return {"error": f"The guardrail blocked this query ({verdict.reason}): it does not fit the user's request. Rewrite it to answer exactly what was asked."}
    return _run_tool(turn, name, args)


def _run_tool(turn: Turn, name: str, args: dict) -> dict:
    if name == "set_filters":
        return _set_filters(turn, args)
    if name == "open_section":
        if args.get("section") not in SECTIONS:
            return {"error": f"unknown section, use one of {SECTIONS}"}
        turn.section = args["section"]
        return {"ok": True}
    if name == "get_view":
        lo, hi = af.data_bounds()
        return {
            "filters": turn.f.as_dict(),
            "compare": turn.compare,
            "where": af.where(turn.f),
            "orders_in_filter": am.stats(turn.f)["n"],
            "data_range": {"start": lo.isoformat(), "end": hi.isoformat()},
        }
    if name == "remember":
        r = knowledge.remember(turn.user_id, str(args.get("text", "")))
        if "remembered" in r:
            turn.remembered.append(r["remembered"])
        return r
    if name == "search_kb":
        return knowledge.search_kb(str(args.get("query", "")))
    if name == "get_facets":
        return asec.facets(turn.f)
    if name == "get_kpis":
        return _get_kpis(turn, args)
    if name == "create_dashboard":
        return _create_dashboard(turn, args)
    if name == "forecast_demand":
        return _forecast_demand(turn, args)
    if name in ("run_sql", "make_chart"):
        sql = with_filters(args.get("sql", ""), turn.f)  # {{WHERE}} (for dashboard widgets) becomes the current view's filters, so it can be tested
        try:
            rows = run_readonly(sql)
        except UnsafeSQL as e:
            log.warning("%s failed: %s | %s", name, e, " ".join(sql.split())[:400])  # so a flood of failed queries can be diagnosed
            return {"error": str(e)}
        turn.queries.append({"sql": sql, "formulas": list(args.get("formulas") or [])})
        if name == "make_chart":
            y = [c for c in (args.get("y") or [])][:MAX_SERIES]
            chart = clean_widget({"kind": "chart", "title": args.get("title", ""), "sql": sql, "chart_type": args.get("type"), "x": args.get("x"), "y": y,
                                  "series": args.get("series"), "y_line": args.get("y_line"), "target": args.get("target"), "size": args.get("size")})
            if why := missing_columns(chart, rows):
                return {"error": why}
            turn.chart = {
                "type": chart["chart_type"],
                "x": args.get("x"),
                "y": y,
                **{k: chart[k] for k in ("series", "y_line", "target", "size") if k in chart},
                "title": args.get("title", ""),
                "rows": rows,
                "sql": sql,
            }
            return {"shown_to_user": True, "row_count": len(rows), "rows": rows[:50]}
        return {"row_count": len(rows), "rows": rows[:100]}
    return {"error": f"unknown tool {name}"}
