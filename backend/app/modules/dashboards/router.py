"""Saved dashboards: list, save, open (re-rendered with current data and the viewer's filters), delete."""
from fastapi import APIRouter, Depends, HTTPException

from ...core.ratelimit import per_user
from ...core.security import SessionUser, current_user, logged_in
from ..analytics.dependencies import filters_from, get_filters
from ..analytics.filters import Filters
from . import repository
from .schemas import DashboardIn, PreviewIn
from .service import clean_filters, default_filters, render_widgets, restrict

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"], dependencies=[logged_in])


@router.get("")
def dashboards() -> list[dict]:
    return repository.list_dashboards()


def _spec(body: DashboardIn) -> dict:
    """What is stored: the plan, the widgets and the filters (checked against the data)."""
    try:
        filters = clean_filters([x.model_dump(exclude_none=True) for x in body.filters])
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return {"plan": body.plan, "widgets": [w.model_dump(exclude_none=True) for w in body.widgets], "filters": filters}


@router.post("", dependencies=[per_user("dash-save", "DASH_SAVES_PER_HOUR", 3600)])
def save_dashboard(body: DashboardIn, user: SessionUser = Depends(current_user)) -> dict:
    return {"id": repository.save_dashboard(body.title, _spec(body), user.email)}


@router.post("/preview", dependencies=[per_user("dash-open", "DASH_OPENS_PER_MINUTE", 60)])
def preview(body: PreviewIn) -> dict:
    """Render a draft (not saved yet) the way it will open: its widgets with the viewer's filter values, limited to the filters
    the draft declares. `values` None shows the draft's own defaults."""
    spec = _spec(body)
    applied = restrict(filters_from(body.values), spec["filters"]) if body.values is not None else default_filters(spec["filters"])
    return {"widgets": render_widgets(spec["widgets"], applied), "applied": applied.as_dict()}


@router.put("/{dashboard_id}", dependencies=[per_user("dash-save", "DASH_SAVES_PER_HOUR", 3600)])
def update_dashboard(dashboard_id: int, body: DashboardIn, user: SessionUser = Depends(current_user)) -> dict:
    """Replace a saved dashboard (an AI-proposed change the user accepted). Yours, or any if you are the admin."""
    if not repository.update_dashboard(dashboard_id, body.title, _spec(body), None if user.role == "admin" else user.email):
        raise HTTPException(404, "dashboard not found")  # not yours looks like missing
    return {"id": dashboard_id}


@router.get("/{dashboard_id}", dependencies=[per_user("dash-open", "DASH_OPENS_PER_MINUTE", 60)])
def dashboard(dashboard_id: int, custom: bool = False, f: Filters = Depends(get_filters), user: SessionUser = Depends(current_user)) -> dict:
    """`custom` says the viewer has set the filters (the query string is then the whole truth, empty meaning "all");
    without it the dashboard opens on the defaults its author gave it. Only filters the dashboard declares can narrow it."""
    d = repository.get_dashboard(dashboard_id)
    if not d:
        raise HTTPException(404, "dashboard not found")
    declared = d["spec"].get("filters", [])
    applied = restrict(f, declared) if custom else default_filters(declared)
    return {
        "id": d["id"], "title": d["title"], "created_at": d["created_at"], "plan": d["spec"]["plan"],
        "widgets": render_widgets(d["spec"]["widgets"], applied), "filters": declared, "applied": applied.as_dict(),
        "can_edit": user.role == "admin" or d["created_by"] == user.email,  # whether the UI offers "change with AI"
    }


@router.delete("/{dashboard_id}")
def delete_dashboard(dashboard_id: int, user: SessionUser = Depends(current_user)) -> dict:
    if not repository.delete_dashboard(dashboard_id, None if user.role == "admin" else user.email):  # not yours looks like missing
        raise HTTPException(404, "dashboard not found")
    return {}
