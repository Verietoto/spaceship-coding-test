from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from ..dashboards.schemas import DashboardIn


MAX_HISTORY = 20
MAX_CONTENT = 4000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str  # clipped, never refused: a long earlier answer must not make the next question fail

    @field_validator("content")
    @classmethod
    def _clip(cls, v: str) -> str:
        return v[:MAX_CONTENT]


class CopilotRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = []  # only the most recent MAX_HISTORY are kept
    filters: dict[str, Any] = {}
    compare: Literal["prev", "base", "none"] = "prev"
    lang: Literal["id", "en"] = "id"

    @field_validator("history")
    @classmethod
    def _recent(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        return v[-MAX_HISTORY:]


class ExplainRequest(BaseModel):
    facts: str = Field(min_length=1, max_length=4000)
    lang: Literal["id", "en"] = "id"


class Answer(BaseModel):
    question: str = Field(max_length=300)
    answer: str = Field(min_length=1, max_length=300)


class BuilderRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    lang: Literal["id", "en"] = "id"
    answers: list[Answer] = Field(default=[], max_length=3)  # what the user said to the clarifying questions so far
    draft: DashboardIn | None = None  # the draft on screen: then `prompt` is a change to it, not a new request


class ClarifyResponse(BaseModel):
    status: Literal["ready", "ask", "refused"]
    question: str | None = None
    options: list[str] = []
    round: int | None = None
    max: int | None = None
    message: str | None = None


class CopilotResponse(BaseModel):
    """The only fields that leave the API; the agents' internal messages and state never do."""

    answer: str
    changes: list[dict[str, Any]]
    filters: dict[str, Any]
    compare: Literal["prev", "base", "none"]
    section: str | None
    chart: dict[str, Any] | None
    calc: dict[str, Any] | None
    route: dict[str, Any] | None = None  # what Jev loaded for this request
    remembered: list[dict[str, Any]] = []  # facts saved about the user during this request
    guard: dict[str, Any] | None = None  # what the guardrails decided: {input, tools: [...]}


class BuilderResponse(BaseModel):
    title: str
    plan: list[str]
    widgets: list[dict[str, Any]]
    filters: list[dict[str, Any]] = []  # the filters the agent gave the dashboard
    applied: dict[str, Any] | None = None  # what the widgets in this draft were rendered with
