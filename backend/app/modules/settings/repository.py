"""Backoffice settings: key/value rows."""
from sqlalchemy import delete, select

from ...db.engine import SessionLocal, iso
from .models import AppSetting


def get_all(prefix: str) -> dict[str, dict]:
    with SessionLocal() as s:
        rows = s.scalars(select(AppSetting).where(AppSetting.key.like(f"{prefix}%"))).all()
    return {r.key: {"value": r.value, "updated_by": r.updated_by, "updated_at": iso(r.updated_at)} for r in rows}


def set_many(values: dict[str, str], user: str | None) -> None:
    with SessionLocal.begin() as s:
        for key, value in values.items():
            row = s.get(AppSetting, key)
            if row is None:
                s.add(AppSetting(key=key, value=value, updated_by=user))
            else:
                row.value, row.updated_by = value, user


def delete_keys(keys: list[str]) -> None:
    with SessionLocal.begin() as s:
        s.execute(delete(AppSetting).where(AppSetting.key.in_(keys)))
