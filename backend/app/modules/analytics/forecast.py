"""Demand forecast: monthly orders or units, for everything, one category or one SKU.

Three simple methods compete (moving average, simple exponential smoothing, linear trend); the one with the smallest error on the
last six months, predicted one month ahead each time, is used. A naive "same as last month" forecast is only a yardstick. The
error measure is WAPE (sum of absolute errors / sum of actuals): with monthly counts this small, MAPE explodes on a quiet month.

A SKU has too few orders to forecast on its own (most have one in a year), so its forecast is its category's forecast times the
SKU's share of that category. Units also get an inventory recommendation: the forecast over the horizon plus safety stock.
"""
import math

from ...db.engine import query
from .filters import Filters, add_months, all_categories, data_bounds, sku_category, where

METRICS = {"orders": "count(*)", "units": "coalesce(sum(quantity), 0)"}
METHODS = ("moving_average", "ses", "linear_trend")  # simplest first: on a tie the earlier one wins
SERVICE_Z = {0.8: 0.8416, 0.9: 1.2816, 0.95: 1.6449}  # service level -> normal z
Z80 = 1.2816  # the 80% range: 10% of the mass on each side
WINDOW = 3  # months of the moving average
BACKTEST_MONTHS = 6
MAX_HORIZON = 6


def ses_fit(y: list[float]) -> dict:
    best, best_sse = 0.3, math.inf
    for i in range(96):  # alpha 0.05 .. 1.00
        a = 0.05 + i * 0.01
        level, sse = y[0], 0.0
        for t in range(1, len(y)):
            e = y[t] - level
            sse += e * e
            level += a * e
        if sse < best_sse:
            best, best_sse = a, sse
    level, errs = y[0], []
    for t in range(1, len(y)):
        e = y[t] - level
        errs.append(e)
        level += best * e
    sd = math.sqrt(sum(e * e for e in errs) / max(len(errs), 1))
    return {"alpha": best, "level": level, "sd": sd}


def predict(method: str, y: list[float], h: int) -> tuple[list[float], dict]:
    """`h` future months from the history `y`, and the parameters the method used. Never negative."""
    if method == "naive":
        return [float(y[-1])] * h, {}
    if method == "moving_average":
        k = min(WINDOW, len(y))
        return [sum(y[-k:]) / k] * h, {"window": k}
    if method == "ses":
        fit = ses_fit(y)
        return [fit["level"]] * h, {"alpha": round(fit["alpha"], 2)}
    if method == "linear_trend":
        n = len(y)
        if n < 3:
            return [sum(y) / n] * h, {"slope": 0.0}
        mx, my = (n - 1) / 2, sum(y) / n
        slope = sum((x - mx) * (v - my) for x, v in enumerate(y)) / sum((x - mx) ** 2 for x in range(n))
        return [max(0.0, my - slope * mx + slope * (n + i)) for i in range(h)], {"slope": round(slope, 2)}
    raise ValueError(f"unknown method {method}")


def backtest(y: list[float], method: str) -> dict:
    """Predict each of the last months from the months before it. WAPE and MAE (None without data) and the error's spread."""
    errs, actual = [], []
    for t in range(max(3, len(y) - BACKTEST_MONTHS), len(y)):
        errs.append(y[t] - predict(method, y[:t], 1)[0][0])
        actual.append(y[t])
    if not errs:
        return {"wape": None, "mae": None, "sd": 0.0}
    total = sum(actual)
    return {
        "wape": sum(abs(e) for e in errs) / total if total > 0 else None,
        "mae": sum(abs(e) for e in errs) / len(errs),
        "sd": math.sqrt(sum(e * e for e in errs) / len(errs)),
    }


def choose(scores: dict[str, dict]) -> str:
    """The method with the smallest WAPE; a tie (or no way to tell) goes to the simpler one."""
    best = None
    for m in METHODS:
        w = scores[m]["wape"]
        if w is not None and (best is None or w < scores[best]["wape"] - 1e-9):
            best = m
    return best or METHODS[0]


def inventory(points: list[dict], sd: float, service: float) -> dict:
    """Units to have available over the horizon: the forecast plus safety stock z x error x sqrt(months)."""
    planned = sum(p["mid"] for p in points)
    safety = SERVICE_Z[service] * sd * math.sqrt(len(points))
    return {"service": service, "z": SERVICE_Z[service], "planned": planned, "safety": safety, "total": math.ceil(planned + safety), "months": len(points)}


def series(f: Filters, metric: str, category: str | None = None, sku: str | None = None) -> list[float]:
    """The metric per month over the whole data (the date filter is ignored; every other filter applies). Category and SKU
    must be values the data has: they are checked by `forecast` before they get here."""
    cond = where(f, period=False)
    if category:
        cond += f" AND product_category = '{category}'"
    if sku:
        cond += f" AND sku = '{sku}'"
    found = {r["ym"]: r["v"] for r in query(f"SELECT to_char(order_date, 'YYYY-MM') AS ym, {METRICS[metric]} AS v FROM orders WHERE {cond} GROUP BY 1")}
    lo, hi = data_bounds()
    start, months = lo.replace(day=1), (hi.year - lo.year) * 12 + hi.month - lo.month + 1
    return [float(found.get(add_months(start, i).strftime("%Y-%m"), 0)) for i in range(months)]


def forecast(f: Filters, metric: str = "orders", horizon: int = 3, category: str | None = None, sku: str | None = None, service: float = 0.9) -> dict:
    """Raises ValueError for anything the data cannot answer (unknown metric, horizon, category, SKU, service level)."""
    if metric not in METRICS:
        raise ValueError(f"metric must be one of {list(METRICS)}")
    if not 1 <= horizon <= MAX_HORIZON:
        raise ValueError(f"horizon must be 1 to {MAX_HORIZON} months")
    if service not in SERVICE_Z:
        raise ValueError(f"service level must be one of {list(SERVICE_Z)}")
    if sku:
        sku = sku.strip().upper()
        owner = sku_category(sku)
        if owner is None:
            raise ValueError(f"no SKU {sku} in the data")
        if category and category != owner:
            raise ValueError(f"SKU {sku} is in {owner}, not {category}")
        category = owner
    elif category and category not in all_categories():
        raise ValueError(f"category must be one of {all_categories()}")

    base = series(f, metric, category)  # what the methods are fitted and judged on
    actual = series(f, metric, category, sku) if sku else base
    share, basis = 1.0, None
    if sku:
        share = sum(actual) / sum(base) if sum(base) else 0.0
        basis = {"sku": sku, "category": category, "share": share, "sku_total": sum(actual), "category_total": sum(base)}

    scores = {m: backtest(base, m) for m in METHODS}
    method = choose(scores)
    lo, _ = data_bounds()
    last = add_months(lo.replace(day=1), len(base) - 1)

    def project(m: str) -> dict:
        """What choosing method `m` would show: its months ahead, its range, and its inventory recommendation."""
        mids, params = predict(m, base, horizon)
        sd = scores[m]["sd"]
        points = [
            {
                "ym": add_months(last, h).strftime("%Y-%m"),
                "mid": mid * share,
                "lo": max(0.0, mid - Z80 * sd * math.sqrt(h)) * share,
                "hi": (mid + Z80 * sd * math.sqrt(h)) * share,
            }
            for h, mid in enumerate(mids, 1)
        ]
        return {"params": params, "sd": sd * share, "points": points, "inventory": inventory(points, sd * share, service) if metric == "units" else None}

    shown = {m: project(m) for m in METHODS}
    return {
        "metric": metric, "horizon": horizon, "category": category, "sku": sku,
        "history": actual, "history_start": lo.replace(day=1).strftime("%Y-%m"),
        "method": method, **shown[method],  # the winner: params, sd, points, inventory (what the Copilot reports)
        "methods": [{"name": m, "wape": scores[m]["wape"], "mae": scores[m]["mae"], **shown[m]} for m in METHODS],  # every method, so a user can look at another
        "naive": {k: v for k, v in backtest(base, "naive").items() if k != "sd"},
        "basis": basis,
    }
