"""Dashboard widgets are stored as SQL; rendering re-runs it so a dashboard always shows current data.

A dashboard may declare filters: the period or arrival dates, any value filter (region, warehouse, carrier, client, category, status,
promo, origin, destination, SKU) and any number range (order value, quantity, lead time, order age). A widget follows them by putting the marker
{{WHERE}} in its WHERE clause; at render time the marker becomes the clause built from the validated filter values (the
same generator the main dashboard uses), so only values the data contains ever reach the SQL.
"""
import logging
from dataclasses import replace
from typing import Any

from ...db.readonly import UnsafeSQL, run_readonly
from ..analytics.filters import DIMS, RANGES, Filters, build_filters, where

log = logging.getLogger(__name__)
WIDGET_ERROR = "This widget could not be loaded."
PLACEHOLDER = "{{WHERE}}"
FILTER_KEYS = ("period", "arrived", *DIMS, *RANGES)


def clean_filters(raw: list[dict[str, Any]]) -> list[dict]:
    """The declared filters, validated: a known key, defaults the data contains. Raises ValueError on anything else."""
    out: list[dict] = []
    for r in raw:
        key = r.get("key")
        if key not in FILTER_KEYS:
            raise ValueError(f"unknown filter {key!r}; use one of {list(FILTER_KEYS)}")
        if any(o["key"] == key for o in out):
            continue
        if key in ("period", "arrived"):
            item = {"key": key, **{k: r[k] for k in ("start", "end") if r.get(k)}}
            build_filters(_dates(item))  # parses the dates, rejects start after end
        elif key in RANGES:
            item = {"key": key, **{k: r[k] for k in ("min", "max") if r.get(k) is not None}}
            build_filters(_bounds(item))  # rejects bounds that are not finite numbers, or low above high
        else:
            item = {"key": key, "default": [str(v) for v in r.get("default") or []]}
            build_filters({key: item["default"]})  # rejects values the data does not contain
        out.append(item)
    return out


def _dates(x: dict) -> dict:
    """A declared period or arrival range as the keys build_filters reads."""
    pre = "arrived_" if x["key"] == "arrived" else ""
    return {f"{pre}start": x.get("start"), f"{pre}end": x.get("end")}


def _bounds(x: dict) -> dict:
    return {f"{x['key']}_min": x.get("min"), f"{x['key']}_max": x.get("max")}


def default_filters(declared: list[dict]) -> Filters:
    """What the dashboard shows before the viewer touches a filter."""
    values: dict[str, Any] = {}
    for x in declared:
        if x["key"] in ("period", "arrived"):
            values.update(_dates(x))
        elif x["key"] in RANGES:
            values.update(_bounds(x))
        else:
            values[x["key"]] = x.get("default") or []
    return build_filters(values)


def restrict(f: Filters, declared: list[dict]) -> Filters:
    """Only the declared filters can be used: a request cannot narrow a dashboard by something it does not offer."""
    keys = {x["key"] for x in declared}
    return replace(
        f,
        start=f.start if "period" in keys else None,
        end=f.end if "period" in keys else None,
        arrived_start=f.arrived_start if "arrived" in keys else None,
        arrived_end=f.arrived_end if "arrived" in keys else None,
        ranges=tuple(r for r in f.ranges if r[0] in keys),
        **{d: getattr(f, d) if d in keys else () for d in DIMS},
        exclude=tuple(e for e in f.exclude if e in keys),
    )


def with_filters(sql: str, f: Filters) -> str:
    return sql.replace(PLACEHOLDER, where(f))


def render_widgets(widgets: list[dict], f: Filters | None = None) -> list[dict]:
    """Runs each widget's SQL (with {{WHERE}} filled in) through the guard; a bad widget carries its error instead of failing the dashboard."""
    f = f or Filters()
    out = []
    for w in widgets:
        try:
            out.append({**w, "rows": run_readonly(with_filters(w["sql"], f))})
        except UnsafeSQL as e:
            log.warning("widget %r failed: %s", w.get("title"), e)  # the database's wording stays in the log, not in the page
            out.append({**w, "rows": [], "error": WIDGET_ERROR})
    return out
