"""Report schedules (admin only): list, save, delete."""
from fastapi import APIRouter, Depends, HTTPException

from ...core.security import SessionUser, current_user, require_admin
from ..analytics.dependencies import filters_from
from . import repository
from .schemas import ScheduleIn

router = APIRouter(prefix="/api/schedules", tags=["schedules"], dependencies=[Depends(require_admin)])


@router.get("")
def schedules() -> list[dict]:
    # Schedules saved before multi-value filters hold {"period": "Q4", "carrier": "UPS"}; always answer in the current shape.
    return [{**s, "filters": filters_from(s["filters"]).as_dict()} for s in repository.list_schedules()]


@router.post("")
def save_schedule(body: ScheduleIn, user: SessionUser = Depends(current_user)) -> dict:
    f = filters_from(body.filters)
    # ponytail: stored only; no email is sent (design doc: delivery is simulated). Add a cron + mail provider to send.
    return {"id": repository.save_schedule(body.frequency, body.recipients, list(body.contents), f.as_dict(), user.email)}


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int) -> dict:
    if not repository.delete_schedule(schedule_id):
        raise HTTPException(404, "schedule not found")
    return {}
