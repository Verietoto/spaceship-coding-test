"""Saved filter views: everyone sees them all, saves under their own account, and deletes only their own (the admin any)."""
from fastapi import APIRouter, Depends, HTTPException

from ...core.security import SessionUser, current_user, logged_in
from ..analytics.dependencies import filters_from
from . import repository
from .schemas import PresetIn

router = APIRouter(prefix="/api/presets", tags=["presets"], dependencies=[logged_in])


@router.get("")
def presets() -> list[dict]:
    # Normalise on the way out, so a preset always comes back in the current filter shape.
    return [{**p, "filters": {**filters_from(p["filters"]).as_dict(), "compare": p["filters"].get("compare", "prev")}} for p in repository.list_presets()]


@router.post("")
def save_preset(body: PresetIn, user: SessionUser = Depends(current_user)) -> dict:
    f = filters_from(body.filters)  # 422 on values the data doesn't contain
    return {"id": repository.save_preset(body.name.strip(), {**f.as_dict(), "compare": body.compare}, user.email)}


@router.delete("/{preset_id}")
def delete_preset(preset_id: int, user: SessionUser = Depends(current_user)) -> dict:
    if not repository.delete_preset(preset_id, None if user.role == "admin" else user.email):
        raise HTTPException(404, "preset not found")
    return {}
