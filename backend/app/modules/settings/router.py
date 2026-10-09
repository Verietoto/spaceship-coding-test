"""Backoffice (admin only): the AI provider, key and model. Knowledge documents are managed in modules/knowledge."""
from fastapi import APIRouter, Depends

from ...core.ratelimit import per_user
from ...core.security import SessionUser, require_admin
from . import service
from .schemas import AiIn

router = APIRouter(prefix="/api/admin", tags=["backoffice"], dependencies=[Depends(require_admin)])


@router.get("/ai")
def ai_settings() -> dict:
    return service.ai_view()


@router.put("/ai")
def save_ai_settings(body: AiIn, user: SessionUser = Depends(require_admin)) -> dict:
    return service.save_ai(body, user.email)


@router.delete("/ai/key")
def remove_ai_key(user: SessionUser = Depends(require_admin)) -> dict:
    return service.clear_key(user.email)


@router.post("/ai/test", dependencies=[per_user("ai-min", "AI_PER_MINUTE", 60)])  # a test is a paid request
def test_ai_settings(body: AiIn) -> dict:
    return service.test_ai(body)
