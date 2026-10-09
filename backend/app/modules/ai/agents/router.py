"""Routing with Jev (TypeSafe): decide, before any LLM call, which tools and subagents this request needs.

Jev answers typed questions about the request with probabilities, in tens to hundreds of milliseconds. Only what it
selects is loaded into the coordinator, so the model never sees tools it will not use. When Jev is unsure, slow,
failing or not configured, everything is loaded: routing can make a request cheaper, never fail it.
"""
from dataclasses import dataclass, field
from functools import cache
from typing import Any

from langchain_typesafe import Choice, Noul, TypeSafeClassifier

from ....core.config import JEV_THRESHOLD, JEV_TIMEOUT_MS, TYPESAFE_API_KEY
from . import analyst, builder, charter, forecaster
from .context import Ctx

REGISTRY = [analyst, charter, builder, forecaster]
VIEW_TOOLS = ("set_filters", "open_section")
KB_TOOLS = ("search_kb",)  # loaded only when Jev says the request needs the knowledge base


@dataclass(frozen=True)
class Route:
    subagents: tuple[str, ...]  # names from REGISTRY to load
    tools: tuple[str, ...]  # extra coordinator tools (get_view is always loaded)
    intent: str | None = None
    scores: dict[str, float] = field(default_factory=dict)
    source: str = "jev"  # "jev" or "fallback"
    reason: str | None = None  # why it fell back

    def as_dict(self) -> dict:
        return {"source": self.source, "intent": self.intent, "subagents": list(self.subagents), "tools": list(self.tools), "scores": self.scores, "reason": self.reason}


def fallback(reason: str) -> Route:
    return Route(subagents=tuple(s.NAME for s in REGISTRY), tools=(*VIEW_TOOLS, *KB_TOOLS), source="fallback", reason=reason)


def questions() -> dict[str, Any]:
    """One yes/no question per subagent (from its DESCRIPTION), one for changing the view, and one overall intent."""
    qs: dict[str, Any] = {
        f"needs_{s.NAME}": Noul(instructions=f"Does answering the user's request require this specialist? {s.DESCRIPTION}") for s in REGISTRY
    }
    qs["changes_view"] = Noul(instructions="Does the user ask to change the dashboard's filters, period, comparison, or to open a section?")
    qs["needs_kb"] = Noul(instructions="Does answering need the team's own documents (see team_documents) such as SLA terms, carrier or client agreements, business rules, facts about the dashboard's author, or any person or term they describe?")
    qs["intent"] = Choice(
        instructions="What does the user's request mainly ask for?",
        criteria={
            "view_only": "Only change what the dashboard shows (filters, period, comparison, section); no new analysis.",
            **{s.INTENT: s.DESCRIPTION for s in REGISTRY},
            "explain": "Asks what a card, metric, chart or section of the dashboard means or how it is calculated, without asking for its current value.",
            "knowledge": "A question answered from the team's own documents (see team_documents): SLA terms, carrier or client agreements, business rules, who made this dashboard, or any person or term those documents describe. "
            "Not the meaning of the dashboard's cards and metrics, and not their current values.",
            "out_of_scope": "Not about this logistics data, this dashboard, its knowledge base, its author, or the assistant itself (who it is, what it can do, greetings).",
        },
    )
    return qs


@cache
def jev_client() -> TypeSafeClassifier:  # shared with the guardrails (ai/guard.py)
    return TypeSafeClassifier(api_key=TYPESAFE_API_KEY, timeout=JEV_TIMEOUT_MS / 1000)


def route(message: str, ctx: Ctx, classifier: Any = None) -> Route:
    if classifier is None:
        if not TYPESAFE_API_KEY:
            return fallback("TYPESAFE_API_KEY is not set")
        classifier = jev_client()
    try:
        resp = classifier.invoke({"state": {"request": message, "dashboard_view": ctx.f.as_dict(), "team_documents": list(ctx.docs)}, "questions": questions()})
        scores = {k: float(v.noul) for k, v in resp.nouls.items()}
        choice = resp.choices["intent"]
    except Exception as e:  # noqa: BLE001  any Jev failure means "load everything", never "fail the request"
        return fallback(f"{type(e).__name__}")

    intent, confidence = choice.choice, float(choice.confidence)
    if confidence < JEV_THRESHOLD:
        return fallback(f"low confidence on intent ({confidence:.2f})")
    if intent in ("out_of_scope", "explain"):  # nothing to load: the coordinator answers from its prompt (glossary, who it is) or declines
        return Route(subagents=(), tools=(), intent=intent, scores=scores)

    wanted = {s.NAME for s in REGISTRY if scores.get(f"needs_{s.NAME}", 0.0) >= JEV_THRESHOLD}
    wanted |= {s.NAME for s in REGISTRY if s.INTENT == intent}
    tools = VIEW_TOOLS if scores.get("changes_view", 0.0) >= JEV_THRESHOLD or intent == "view_only" else ()
    if scores.get("needs_kb", 0.0) >= JEV_THRESHOLD or intent == "knowledge":
        tools = (*tools, *KB_TOOLS)
    if not wanted and not tools:
        return fallback("nothing selected")
    return Route(subagents=tuple(s.NAME for s in REGISTRY if s.NAME in wanted), tools=tools, intent=intent, scores=scores)
