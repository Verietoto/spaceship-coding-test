"""Saved filter views ("presets")."""
from sqlalchemy import delete, select

from ...db.engine import SessionLocal, iso
from .models import FilterPreset


def list_presets() -> list[dict]:
    with SessionLocal() as s:
        rows = s.scalars(select(FilterPreset).order_by(FilterPreset.name, FilterPreset.id)).all()
    return [{"id": r.id, "name": r.name, "filters": r.filters, "created_at": iso(r.created_at)} for r in rows]


def save_preset(name: str, filters: dict, user: str | None) -> int:
    with SessionLocal.begin() as s:
        r = FilterPreset(name=name, filters=filters, created_by=user)
        s.add(r)
        s.flush()
        return r.id


def delete_preset(preset_id: int, owner: str | None = None) -> bool:
    """`owner` set: only that account's row can go (the admin passes None and may delete any)."""
    q = delete(FilterPreset).where(FilterPreset.id == preset_id)
    if owner is not None:
        q = q.where(FilterPreset.created_by == owner)
    with SessionLocal.begin() as s:
        return s.execute(q).rowcount > 0
