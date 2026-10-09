"""PostgreSQL connections: the app engine/sessions, and `query()` for the analytics SQL the backend writes."""
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from ..core.config import DATABASE_URL

AS_OF = "2025-12-30"  # "today" for the order data: in-transit age is measured to this date

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def plain(v: Any) -> Any:
    """Postgres returns NUMERIC (e.g. avg of integers) as Decimal; the API has always sent JSON floats."""
    return float(v) if isinstance(v, Decimal) else v


def iso(ts: datetime) -> str:
    """Timestamps leave the API as UTC ISO strings with seconds, e.g. 2026-10-07T10:00:00+00:00."""
    return ts.astimezone(UTC).isoformat(timespec="seconds")


def query(sql: str, params: dict | None = None) -> list[dict]:
    with engine.connect() as con:
        rows = con.execute(text(sql), params or {}).mappings().all()
    return [{k: plain(v) for k, v in r.items()} for r in rows]
