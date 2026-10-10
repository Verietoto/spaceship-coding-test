"""Dashboard widget specs as the Builder produces them: cleaned before they are rendered or saved."""
import math
from decimal import Decimal

from ...dashboards.schemas import MAX_SERIES
from ..llm import CHART_TYPES

HIGHLIGHT_MODES = ["top", "bottom"]
MIN_SPAN = {"kpi": 2, "chart": 4}  # narrower than this is not readable; a layout never exceeds 12 columns
MAX_SPAN = 12
WIDGET_FORMATS = ["number", "usd", "pct", "days"]


NEEDS_SERIES = {"heatmap": "columns", "sankey": "targets"}  # chart types whose rows are x, series, y


def _is_number(v: object) -> bool:
    return isinstance(v, int | float | Decimal) and not isinstance(v, bool)


def _number(v: object) -> float | None:
    """A finite number, or None (a target the model wrote as text or NaN is dropped, not trusted)."""
    return float(v) if isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v) else None


def missing_columns(w: dict, rows: list[dict]) -> str | None:
    """Why a chart widget's result cannot be drawn as asked (a column it names is not in the SQL's output, or the values are not numbers); None when it can."""
    if w.get("kind") != "chart" or w.get("chart_type") == "table" or not rows:
        return None
    have = set(rows[0])
    asked = [w.get("x"), w.get("series"), w.get("size"), *(w.get("y") or []), *(w.get("y_line") or [])]
    gone = [c for c in asked if c and c not in have]
    if gone or not w.get("x") or not w.get("y"):
        return f"chart columns {gone or ['x/y']} are not in the SQL result (it returns {sorted(have)}): alias the columns to match x, series, y, y_line and size"
    kind = w.get("chart_type")
    if kind in NEEDS_SERIES and not w.get("series"):
        return f"a {kind} needs `series`: the column for its {NEEDS_SERIES[kind]} (rows are x, series, y)"
    for c in [*(w.get("y") or []), *(w.get("y_line") or []), *([w["size"]] if w.get("size") else []), *([w["x"]] if kind == "scatter" else [])]:
        values = [r[c] for r in rows if r[c] is not None]
        if values and not all(_is_number(v) for v in values):
            return f"chart column {c} must be numeric"
    return None


def clean_widget(w: dict) -> dict:
    kind = "chart" if w.get("kind") == "chart" else "kpi"
    out = {"kind": kind, "title": str(w.get("title", ""))[:120], "sql": str(w.get("sql", "")), "formulas": [str(x) for x in w.get("formulas") or []]}
    if kind == "kpi":
        out["format"] = w.get("format") if w.get("format") in WIDGET_FORMATS else "number"
        target = _number(w.get("target"))
        if target is not None:
            out |= {"target": target, "better": "low" if w.get("better") == "low" else "high"}
    else:
        out |= {
            "chart_type": w.get("chart_type") if w.get("chart_type") in CHART_TYPES else "bar",
            "x": str(w.get("x", "")),
            "y": [str(y) for y in (w.get("y") or [])][:MAX_SERIES],
        }
        if w.get("series"):
            out["series"] = str(w["series"])[:60]
        if w.get("y_line"):
            out["y_line"] = [str(y) for y in w["y_line"]][:4]
        if w.get("size"):
            out["size"] = str(w["size"])[:60]
        target = _number(w.get("target"))
        if target is not None:
            out["target"] = target
        h = w.get("highlight")
        if isinstance(h, dict) and h.get("mode") in HIGHLIGHT_MODES and isinstance(h.get("n"), int) and 1 <= h["n"] <= 5:
            out["highlight"] = {"mode": h["mode"], "n": h["n"]}
    span = w.get("span")
    if isinstance(span, float) and span.is_integer():
        span = int(span)
    if isinstance(span, int) and not isinstance(span, bool):  # tidied into the readable range rather than refused: one odd number must not fail the dashboard
        out["span"] = max(MIN_SPAN[kind], min(MAX_SPAN, span))
    return out
