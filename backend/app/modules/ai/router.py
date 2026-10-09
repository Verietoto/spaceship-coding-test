"""AI endpoints: copilot chat, explanations, report summary, dashboard builder.

Every one costs LLM money and holds a worker for seconds, so each user has a budget (per minute and per hour) and a cap on
requests running at once (core/ratelimit.py); over it the answer is 429.
"""
import json
from collections.abc import Callable, Iterable, Iterator
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ...core import config
from ...core.errors import run_ai, stream_ai
from ...core.ratelimit import limiter, per_user
from ...core.security import SessionUser, current_user, logged_in
from ..analytics.dependencies import filters_from, get_filters
from ..analytics.filters import Filters
from . import builder, clarify, copilot, reports
from .schemas import BuilderRequest, BuilderResponse, ClarifyResponse, CopilotRequest, CopilotResponse, ExplainRequest

router = APIRouter(prefix="/api", tags=["ai"], dependencies=[logged_in])
BUDGET = [per_user("ai-min", "AI_PER_MINUTE", 60), per_user("ai-hour", "AI_PER_HOUR", 3600)]
STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _draft(body: BuilderRequest) -> dict | None:
    return body.draft.model_dump(exclude_none=True) if body.draft else None


def _running(user: SessionUser) -> str:
    return f"ai-open:{user.id}"


def _ndjson(events: Iterable[dict]) -> Iterator[str]:
    """One JSON object per line; the final response is validated against the same model as /api/copilot."""
    for event in events:
        if event["type"] == "done" and "response" in event:
            event = {**event, "response": CopilotResponse(**event["response"]).model_dump()}
        yield json.dumps(event, default=str) + "\n"


def _stream(user: SessionUser, events: Callable[[], Iterable[dict]]) -> StreamingResponse:
    """A progress stream that holds one of the user's running-request slots until it ends (or the client drops)."""
    limiter.acquire(_running(user), config.AI_CONCURRENT)

    def body() -> Iterator[str]:
        try:
            yield from _ndjson(stream_ai(events()))
        finally:
            limiter.release(_running(user))

    return StreamingResponse(body(), media_type="application/x-ndjson", headers=STREAM_HEADERS)


@router.post("/copilot", response_model=CopilotResponse, dependencies=BUDGET)
def copilot_chat(body: CopilotRequest, user: SessionUser = Depends(current_user)) -> dict:
    history = [h.model_dump() for h in body.history]
    with limiter.slot(_running(user), "AI_CONCURRENT"):
        return run_ai(copilot.copilot, body.message, history, filters_from(body.filters), body.compare, body.lang, user.id)


@router.post("/copilot/stream", dependencies=BUDGET)
def copilot_stream(body: CopilotRequest, user: SessionUser = Depends(current_user)) -> StreamingResponse:
    """The copilot as a stream of progress events (route, agents, tools) ending with `done`; /api/copilot is the same without them."""
    history = [h.model_dump() for h in body.history]
    f = filters_from(body.filters)
    return _stream(user, lambda: copilot.run_copilot(body.message, history, f, body.compare, body.lang, user.id))


@router.post("/explain", dependencies=BUDGET)
def explain(body: ExplainRequest, user: SessionUser = Depends(current_user)) -> dict:
    with limiter.slot(_running(user), "AI_CONCURRENT"):
        return {"text": run_ai(reports.explain, body.facts, body.lang)}


@router.get("/summary", dependencies=BUDGET)
def summary(f: Filters = Depends(get_filters), lang: Literal["id", "en"] = "id", user: SessionUser = Depends(current_user)) -> dict:
    with limiter.slot(_running(user), "AI_CONCURRENT"):
        return run_ai(reports.report_summary, f, lang)


@router.post("/builder", response_model=BuilderResponse, dependencies=BUDGET)
def build(body: BuilderRequest, user: SessionUser = Depends(current_user)) -> dict:
    with limiter.slot(_running(user), "AI_CONCURRENT"):
        return run_ai(builder.build_dashboard, body.prompt, body.lang, [a.model_dump() for a in body.answers], _draft(body))


@router.post("/builder/clarify", response_model=ClarifyResponse, dependencies=BUDGET)
def builder_clarify(body: BuilderRequest, user: SessionUser = Depends(current_user)) -> dict:
    """Is the request clear enough to build? If not, one more question with options (the user may type their own answer)."""
    with limiter.slot(_running(user), "AI_CONCURRENT"):
        return run_ai(clarify.clarify, body.prompt, [a.model_dump() for a in body.answers], body.lang)


@router.post("/builder/stream", dependencies=BUDGET)
def builder_stream(body: BuilderRequest, user: SessionUser = Depends(current_user)) -> StreamingResponse:
    """The build as progress events (agent, tool, tool_done, ...) ending with `done` (the draft) or `refused`."""
    return _stream(user, lambda: builder.stream_build(body.prompt, body.lang, [a.model_dump() for a in body.answers], _draft(body)))
