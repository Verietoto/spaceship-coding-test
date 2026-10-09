"""Guardrail events: only what blocked or flagged a request is stored."""
from collections.abc import Iterable

from ...db.engine import SessionLocal
from .models import GuardEvent


def log_events(user_id: int | None, verdicts: Iterable[dict]) -> None:
    rows = [GuardEvent(user_id=user_id, stage=v["stage"], action=v["action"], reason=v["reason"]) for v in verdicts if v["action"] in ("warn", "block")]
    if rows:
        with SessionLocal.begin() as s:
            s.add_all(rows)
