"""Saved dashboards (from the AI Builder)."""
from sqlalchemy import delete, select, update

from ...db.engine import SessionLocal, iso
from .models import Dashboard


def list_dashboards() -> list[dict]:
    with SessionLocal() as s:
        rows = s.execute(select(Dashboard.id, Dashboard.title, Dashboard.created_at).order_by(Dashboard.id.desc())).all()
    return [{"id": r.id, "title": r.title, "created_at": iso(r.created_at)} for r in rows]


def get_dashboard(dashboard_id: int) -> dict | None:
    with SessionLocal() as s:
        d = s.get(Dashboard, dashboard_id)
    if d is None:
        return None
    return {"id": d.id, "title": d.title, "spec": d.spec, "created_by": d.created_by, "created_at": iso(d.created_at)}


def save_dashboard(title: str, spec: dict, user: str | None) -> int:
    with SessionLocal.begin() as s:
        d = Dashboard(title=title, spec=spec, created_by=user)
        s.add(d)
        s.flush()
        return d.id


def update_dashboard(dashboard_id: int, title: str, spec: dict, owner: str | None = None) -> bool:
    """Replace a dashboard's title and spec. `owner` set: only that account's row (the admin passes None and may change any)."""
    q = update(Dashboard).where(Dashboard.id == dashboard_id).values(title=title, spec=spec)
    if owner is not None:
        q = q.where(Dashboard.created_by == owner)
    with SessionLocal.begin() as s:
        return s.execute(q).rowcount > 0


def delete_dashboard(dashboard_id: int, owner: str | None = None) -> bool:
    """`owner` set: only that account's row can go (the admin passes None and may delete any)."""
    q = delete(Dashboard).where(Dashboard.id == dashboard_id)
    if owner is not None:
        q = q.where(Dashboard.created_by == owner)
    with SessionLocal.begin() as s:
        return s.execute(q).rowcount > 0
