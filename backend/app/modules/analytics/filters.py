"""Dashboard filters: a date range plus include/exclude value lists per dimension.

Every value is checked against the data (and dates are parsed), so a validated Filters is safe to inline into SQL.
"""
import math
import re
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass, replace
from datetime import date, timedelta
from functools import cache
from typing import Any

from ...db.engine import query

# dimension name -> column. Every dimension is a list of values (several, or "all except"); each value is checked against the data.
DIM_COLS = {
    "region": "region", "warehouse": "warehouse", "carrier": "carrier", "client": "client_id",
    "category": "product_category", "status": "status", "promo": "is_promo",
    "origin": "origin_city", "destination": "destination_city", "sku": "sku",
}
DIMS = tuple(DIM_COLS)
# numeric range filters: name -> column. A bound is optional on either side and inclusive; an order without a value in the column
# (not arrived yet: no lead time) never passes a bound on it.
RANGES = {"value": "order_value_usd", "quantity": "quantity", "lead": "lead_days", "age": "age_days"}
ARRIVED = "delivery_date"  # the second date range: when the order arrived
MAX_NUMBER = 1e9
PERIOD_RE = re.compile(r"FY|H[12]|Q[1-4]|M([1-9]|1[0-2])")


# Valid values come from the data. Cached on first use (not at import), so importing the app or running
# migrations doesn't need a seeded database. ponytail: process-lifetime cache; reload the process after loading new data.
REGION_ORDER = ["US-W", "US-C", "US-E", "UK", "EU"]  # west to east; regions not listed here follow alphabetically


@cache
def all_regions() -> list[str]:
    found = [r["region"] for r in query("SELECT DISTINCT region FROM orders ORDER BY region")]
    return sorted(found, key=lambda r: (REGION_ORDER.index(r) if r in REGION_ORDER else len(REGION_ORDER), r))


@cache
def all_carriers() -> list[str]:
    return [r["carrier"] for r in query("SELECT DISTINCT carrier FROM orders ORDER BY carrier")]


@cache
def all_warehouses() -> dict[str, str]:
    return {r["warehouse"]: r["region"] for r in query("SELECT DISTINCT warehouse, region FROM orders ORDER BY warehouse")}


@cache
def all_clients() -> list[str]:
    return [r["client_id"] for r in query("SELECT DISTINCT client_id FROM orders ORDER BY client_id")]


@cache
def all_categories() -> list[str]:
    return [r["product_category"] for r in query("SELECT DISTINCT product_category FROM orders ORDER BY product_category")]


@cache
def _sku_categories() -> dict[str, str]:
    return {r["sku"]: r["product_category"] for r in query("SELECT DISTINCT sku, product_category FROM orders")}


def sku_category(sku: str) -> str | None:
    """The category of a SKU (any letter case), or None when the data has no such SKU."""
    return _sku_categories().get(sku.strip().upper())


STATUS_ORDER = ["delivered", "delayed", "in_transit", "exception", "canceled"]  # as the order moves; statuses not listed follow alphabetically


@cache
def all_statuses() -> list[str]:
    found = [r["status"] for r in query("SELECT DISTINCT status FROM orders")]
    return sorted(found, key=lambda s: (STATUS_ORDER.index(s) if s in STATUS_ORDER else len(STATUS_ORDER), s))


@cache
def all_promo() -> list[str]:
    """'0' (regular) and '1' (promo), as the text they are compared and shown as."""
    return [r["v"] for r in query("SELECT DISTINCT is_promo::text AS v FROM orders ORDER BY 1")]


@cache
def all_origins() -> list[str]:
    return [r["origin_city"] for r in query("SELECT DISTINCT origin_city FROM orders ORDER BY origin_city")]


@cache
def all_destinations() -> list[str]:
    return [r["destination_city"] for r in query("SELECT DISTINCT destination_city FROM orders ORDER BY destination_city")]


@cache
def all_skus() -> list[str]:
    return [r["sku"] for r in query("SELECT DISTINCT sku FROM orders ORDER BY sku")]


@cache
def data_ranges() -> dict[str, dict[str, float | str | None]]:
    """The smallest and largest value of each range column (and the first and last arrival date), for placeholders."""
    cols = ", ".join(f"min({c}) AS {k}_lo, max({c}) AS {k}_hi" for k, c in RANGES.items())
    r = query(f"SELECT {cols}, min({ARRIVED}) AS arrived_lo, max({ARRIVED}) AS arrived_hi FROM orders")[0]
    out: dict[str, dict] = {k: {"min": r[f"{k}_lo"], "max": r[f"{k}_hi"]} for k in RANGES}
    out["arrived"] = {"min": r["arrived_lo"].isoformat() if r["arrived_lo"] else None, "max": r["arrived_hi"].isoformat() if r["arrived_hi"] else None}
    return out


@cache
def total_orders() -> int:
    return query("SELECT count(*) AS n FROM orders")[0]["n"]


@cache
def data_bounds() -> tuple[date, date]:
    r = query("SELECT min(order_date) AS lo, max(order_date) AS hi FROM orders")[0]
    return r["lo"], r["hi"]


def data_years() -> list[int]:
    lo, hi = data_bounds()
    return list(range(lo.year, hi.year + 1))


def allowed_values() -> dict[str, Iterable[str]]:
    return {
        "region": all_regions(), "warehouse": all_warehouses(), "carrier": all_carriers(), "client": all_clients(),
        "category": all_categories(), "status": all_statuses(), "promo": all_promo(),
        "origin": all_origins(), "destination": all_destinations(), "sku": all_skus(),
    }


@dataclass(frozen=True)
class Filters:
    start: date | None = None  # None = from the first order
    end: date | None = None  # None = to the last order
    region: tuple[str, ...] = ()  # empty = all
    warehouse: tuple[str, ...] = ()
    carrier: tuple[str, ...] = ()
    client: tuple[str, ...] = ()
    category: tuple[str, ...] = ()  # product category
    status: tuple[str, ...] = ()
    promo: tuple[str, ...] = ()  # "0" regular, "1" promo
    origin: tuple[str, ...] = ()  # origin city
    destination: tuple[str, ...] = ()  # destination city
    sku: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()  # dimensions whose list means "everything except these"
    ranges: tuple[tuple[str, float | None, float | None], ...] = ()  # (name in RANGES, lowest, highest), sorted, at least one bound each
    arrived_start: date | None = None  # arrival date range
    arrived_end: date | None = None

    def __post_init__(self) -> None:
        if self.start and self.end and self.start > self.end:
            raise ValueError("start date is after end date")
        if self.arrived_start and self.arrived_end and self.arrived_start > self.arrived_end:
            raise ValueError("arrival start date is after end date")
        object.__setattr__(self, "ranges", _clean_ranges(self.ranges))
        allowed = allowed_values()
        for dim in DIMS:
            vals = tuple(sorted(set(getattr(self, dim))))
            bad = [v for v in vals if v not in allowed[dim]]
            if bad:
                raise ValueError(f"invalid {dim}: {bad[0]}")
            object.__setattr__(self, dim, vals)
        bad_dims = [d for d in self.exclude if d not in DIMS]
        if bad_dims:
            raise ValueError(f"invalid exclude: {bad_dims[0]}")
        # excluding an empty list means nothing; drop it so equal filters compare equal
        object.__setattr__(self, "exclude", tuple(sorted({d for d in self.exclude if getattr(self, d)})))

    def has_dims(self) -> bool:
        return any(getattr(self, d) for d in DIMS) or bool(self.ranges) or bool(self.arrived_start or self.arrived_end)

    def as_dict(self) -> dict:
        d = asdict(self)
        for k in ("start", "end", "arrived_start", "arrived_end"):
            d[k] = getattr(self, k).isoformat() if getattr(self, k) else None
        for k in (*DIMS, "exclude"):
            d[k] = list(d[k])
        d["ranges"] = {k: [lo, hi] for k, lo, hi in self.ranges}
        return d

    def slug(self) -> str:
        """File-name friendly description, e.g. 2025-10-01_2025-12-31_UPS_FedEx."""
        parts = [self.start.isoformat() if self.start else "", self.end.isoformat() if self.end else ""]
        for d in DIMS:
            vals = getattr(self, d)
            if vals:
                parts += (["not"] if d in self.exclude else []) + [re.sub(r"[^A-Za-z0-9-]+", "-", v) for v in vals]
        for k, lo, hi in self.ranges:
            parts.append(f"{k}{'' if lo is None else _num(lo)}-{'' if hi is None else _num(hi)}")
        if self.arrived_start or self.arrived_end:
            parts.append(f"arrived{self.arrived_start.isoformat() if self.arrived_start else ''}-{self.arrived_end.isoformat() if self.arrived_end else ''}")
        return "_".join(p for p in parts if p) or "all"


FILTER_KEYS = [*DIMS, "start", "end", "exclude", "arrived_start", "arrived_end", *(f"{k}_{b}" for k in RANGES for b in ("min", "max"))]


def _num(v: float) -> str:
    """A bound as plain text for SQL and file names: finite, no exponent (so `10` stays `10`, `2.5` stays `2.5`)."""
    return f"{v:.10g}"


def parse_number(v: Any) -> float | None:
    if v in (None, ""):
        return None
    try:
        n = float(v)
    except (TypeError, ValueError) as e:
        raise ValueError(f"invalid number: {v}") from e
    if not math.isfinite(n) or abs(n) > MAX_NUMBER:
        raise ValueError(f"invalid number: {v}")
    return n


def _clean_ranges(raw: Iterable[tuple[str, float | None, float | None]]) -> tuple[tuple[str, float | None, float | None], ...]:
    out: dict[str, tuple[float | None, float | None]] = {}
    for key, lo, hi in raw:
        if key not in RANGES:
            raise ValueError(f"invalid range: {key}")
        lo, hi = (None if x is None else parse_number(x) for x in (lo, hi))
        if lo is not None and hi is not None and lo > hi:
            raise ValueError(f"{key}: the lowest value is above the highest")
        if lo is not None or hi is not None:
            out[key] = (lo, hi)
    return tuple((k, *out[k]) for k in sorted(out))


# ---------- periods

def add_months(d: date, n: int) -> date:
    m = d.year * 12 + d.month - 1 + n
    return date(m // 12, m % 12 + 1, 1)


def preset_range(code: str, year: int) -> tuple[date, date]:
    """FY, H1/H2, Q1-Q4 or M1-M12 of `year` as an inclusive date range."""
    if not PERIOD_RE.fullmatch(code):
        raise ValueError(f"invalid period: {code}")
    if code == "FY":
        lo, n = 1, 12
    elif code[0] == "H":
        lo, n = (1, 6) if code == "H1" else (7, 6)
    elif code[0] == "Q":
        lo, n = (int(code[1]) - 1) * 3 + 1, 3
    else:
        lo, n = int(code[1:]), 1
    start = date(year, lo, 1)
    return start, add_months(start, n) - timedelta(days=1)


def prev_range(f: Filters) -> tuple[date, date] | None:
    """The period right before the selected one, or None when it would lie before the data.

    A whole number of calendar months (a month, quarter, half or year) shifts back by that many months,
    anything else shifts back by its own length in days.
    """
    if not (f.start and f.end):
        return None
    last_of_month = (f.end + timedelta(days=1)).day == 1
    if f.start.day == 1 and last_of_month:
        months = (f.end.year - f.start.year) * 12 + f.end.month - f.start.month + 1
        prev = (add_months(f.start, -months), f.start - timedelta(days=1))
    else:
        days = (f.end - f.start).days + 1
        prev = (f.start - timedelta(days=days), f.start - timedelta(days=1))
    return prev if prev[1] >= data_bounds()[0] else None


# ---------- building a Filters from request input

def as_list(v: Any) -> list[str]:
    """'all'/''/None -> [], 'UPS' -> ['UPS'], ['UPS', 'FedEx'] -> the list."""
    if v is None:
        return []
    items = [v] if isinstance(v, str) else list(v)
    return [str(i) for i in items if str(i) not in ("", "all")]


def parse_date(v: Any) -> date | None:
    if v in (None, ""):
        return None
    try:
        return date.fromisoformat(str(v))
    except ValueError as e:
        raise ValueError(f"invalid date: {v}") from e


def build_filters(values: Mapping[str, Any]) -> Filters:
    """From a query-string-like or JSON mapping. Accepts the old shape too ({"period": "Q4", "carrier": "UPS"}).

    Explicit start/end win over a `period` preset; the preset's year defaults to the latest year in the data.
    """
    start, end = parse_date(values.get("start")), parse_date(values.get("end"))
    period = values.get("period")
    if period and not (start or end):
        year = int(values.get("year") or data_years()[-1])
        start, end = preset_range(str(period), year)
    nested = values.get("ranges") or {}  # the shape Filters.as_dict() makes: {"value": [10, 50]}
    if not isinstance(nested, Mapping):
        raise ValueError("invalid ranges")
    bounds: list[tuple[str, float | None, float | None]] = []
    for key in RANGES:
        lo, hi = values.get(f"{key}_min"), values.get(f"{key}_max")  # the flat shape of a query string
        if key in nested:
            pair = nested[key]
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ValueError(f"invalid range: {key}")
            lo, hi = pair
        bounds.append((key, parse_number(lo), parse_number(hi)))
    if set(nested) - set(RANGES):
        raise ValueError(f"invalid range: {sorted(set(nested) - set(RANGES))[0]}")
    return Filters(
        start=start,
        end=end,
        **{d: tuple(as_list(values.get(d))) for d in DIMS},
        exclude=tuple(as_list(values.get("exclude"))),
        ranges=tuple(bounds),
        arrived_start=parse_date(values.get("arrived_start")),
        arrived_end=parse_date(values.get("arrived_end")),
    )


def where(f: Filters, skip: tuple[str, ...] = (), period: bool = True) -> str:
    parts = []
    if period:
        if f.start:
            parts.append(f"order_date >= DATE '{f.start.isoformat()}'")
        if f.end:
            parts.append(f"order_date <= DATE '{f.end.isoformat()}'")
    if f.arrived_start:
        parts.append(f"{ARRIVED} >= DATE '{f.arrived_start.isoformat()}'")
    if f.arrived_end:
        parts.append(f"{ARRIVED} <= DATE '{f.arrived_end.isoformat()}'")
    for key, lo, hi in f.ranges:
        if lo is not None:
            parts.append(f"{RANGES[key]} >= {_num(lo)}")
        if hi is not None:
            parts.append(f"{RANGES[key]} <= {_num(hi)}")
    for dim, col in DIM_COLS.items():
        vals = getattr(f, dim)
        if not vals or dim in skip:
            continue
        out = dim in f.exclude
        quoted = [v.replace("'", "''") for v in vals]  # the values are checked against the data, but a city may hold an apostrophe
        if len(vals) == 1:
            parts.append(f"{col} {'<>' if out else '='} '{quoted[0]}'")
        else:
            parts.append(f"{col} {'NOT IN' if out else 'IN'} ({', '.join(f"'{v}'" for v in quoted)})")
    return "\n  AND ".join(parts) or "TRUE"


def without_dims(f: Filters) -> Filters:
    return replace(f, **{d: () for d in DIMS}, exclude=(), ranges=(), arrived_start=None, arrived_end=None)
