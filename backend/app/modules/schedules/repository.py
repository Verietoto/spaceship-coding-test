"""Report schedules (stored only; delivery is simulated)."""
from sqlalchemy import delete, select

from ...db.engine import SessionLocal, iso
from .models import Schedule

FIELDS = ("id", "frequency", "recipients", "contents", "filters", "created_by")


def list_schedules() -> list[dict]:
    with SessionLocal() as s:
        rows = s.scalars(select(Schedule).order_by(Schedule.id.desc())).all()
    return [{**{k: getattr(r, k) for k in FIELDS}, "created_at": iso(r.created_at)} for r in rows]


def save_schedule(frequency: str, recipients: list[str], contents: list[str], filters: dict, user: str | None) -> int:
    with SessionLocal.begin() as s:
        r = Schedule(frequency=frequency, recipients=recipients, contents=contents, filters=filters, created_by=user)
        s.add(r)
        s.flush()
        return r.id


def delete_schedule(schedule_id: int, owner: str | None = None) -> bool:
    """`owner` set: only that account's row can go (the admin passes None and may delete any)."""
    q = delete(Schedule).where(Schedule.id == schedule_id)
    if owner is not None:
        q = q.where(Schedule.created_by == owner)
    with SessionLocal.begin() as s:
        return s.execute(q).rowcount > 0
