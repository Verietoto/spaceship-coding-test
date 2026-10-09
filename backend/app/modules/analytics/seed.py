"""Loads the order CSV into `orders`. Idempotent: does nothing when the table already has rows.

Run after migrations: `python -m app.modules.analytics.seed`.
"""
import csv
from datetime import date

from sqlalchemy import func, insert, select

from ...core.config import DATA_CSV
from .models import Order
from ...db.engine import engine

INTS = ("quantity", "is_promo", "promo_discount_pct")
FLOATS = ("unit_price_usd", "order_value_usd")
DATES = ("order_date", "delivery_date")


def parse(row: dict[str, str]) -> dict:
    out: dict = dict(row)
    for k in INTS:
        out[k] = int(row[k])
    for k in FLOATS:
        out[k] = float(row[k])
    for k in DATES:
        out[k] = date.fromisoformat(row[k]) if row[k] else None  # empty delivery_date = not arrived
    return out


def seed() -> int:
    with engine.begin() as con:
        if con.execute(select(func.count()).select_from(Order)).scalar_one():
            return 0
        with open(DATA_CSV, newline="") as f:
            rows = [parse(r) for r in csv.DictReader(f)]
        con.execute(insert(Order), rows)
        return len(rows)


if __name__ == "__main__":
    print(f"seeded {seed()} orders")
