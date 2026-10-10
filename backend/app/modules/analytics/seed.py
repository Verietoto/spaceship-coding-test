"""Loads the order CSV into `orders`. Idempotent: does nothing when the table already has rows.

Run after migrations: `python -m app.modules.analytics.seed`.
"""
import csv
import sys
from datetime import date
from pathlib import Path

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


def read_rows(path: Path | None = None) -> list[dict]:
    """The CSV's orders, parsed. The file is not part of the repository, so say where it should be when it is missing."""
    path = path or DATA_CSV
    if not path.is_file():
        raise FileNotFoundError(f"order data not found: {path}. Put mock_logistics_data.csv in the data/ folder (it is not in the repository) or set DATA_CSV to its path.")
    with open(path, newline="") as f:
        return [parse(r) for r in csv.DictReader(f)]


def seed() -> int:
    with engine.begin() as con:
        if con.execute(select(func.count()).select_from(Order)).scalar_one():
            return 0  # already loaded: the CSV is only needed the first time
        rows = read_rows()
        con.execute(insert(Order), rows)
        return len(rows)


if __name__ == "__main__":
    try:
        print(f"seeded {seed()} orders")
    except FileNotFoundError as e:
        sys.exit(f"error: {e}")  # one clear line and exit code 1, not a stack trace
