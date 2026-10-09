"""Dashboard widget specs as the Builder produces them: cleaned before they are rendered or saved."""
from ..llm import CHART_TYPES

HIGHLIGHT_MODES = ["top", "bottom"]
MIN_SPAN = {"kpi": 2, "chart": 4}  # narrower than this is not readable; a layout never exceeds 12 columns
MAX_SPAN = 12
WIDGET_FORMATS = ["number", "usd", "pct", "days"]


def clean_widget(w: dict) -> dict:
    kind = "chart" if w.get("kind") == "chart" else "kpi"
    out = {"kind": kind, "title": str(w.get("title", ""))[:120], "sql": str(w.get("sql", "")), "formulas": [str(x) for x in w.get("formulas") or []]}
    if kind == "kpi":
        out["format"] = w.get("format") if w.get("format") in WIDGET_FORMATS else "number"
    else:
        out |= {
            "chart_type": w.get("chart_type") if w.get("chart_type") in CHART_TYPES else "bar",
            "x": str(w.get("x", "")),
            "y": [str(y) for y in (w.get("y") or [])][:4],
        }
        h = w.get("highlight")
        if isinstance(h, dict) and h.get("mode") in HIGHLIGHT_MODES and isinstance(h.get("n"), int) and 1 <= h["n"] <= 5:
            out["highlight"] = {"mode": h["mode"], "n": h["n"]}
    span = w.get("span")
    if isinstance(span, float) and span.is_integer():
        span = int(span)
    if isinstance(span, int) and not isinstance(span, bool):  # tidied into the readable range rather than refused: one odd number must not fail the dashboard
        out["span"] = max(MIN_SPAN[kind], min(MAX_SPAN, span))
    return out
