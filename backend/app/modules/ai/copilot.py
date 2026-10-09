"""Copilot: a request goes through Jev (routing), then to a coordinator agent that changes the view and delegates to
subagents (see agents/__init__.py). The response shape is what the frontend has always received."""
import logging
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from ...core.errors import require_ai_key
from ..analytics import filters as af
from ..knowledge import service as knowledge
from . import agents, guard, language, repository
from .agents import router
from .agents.context import Ctx
from .agents.turn import SECTIONS, Turn, run_tool  # noqa: F401  (re-exported: the tools' core lives in agents/turn.py)

TOO_MANY_STEPS = {"id": "Saya butuh terlalu banyak langkah untuk pertanyaan ini.", "en": "That took too many steps."}


log = logging.getLogger(__name__)


def _blocked(reason: str, verdict: guard.Verdict, f: af.Filters, compare: str, lang: str) -> dict:
    """A refusal that never reached the LLM."""
    return {
        "answer": guard.reply(reason, lang), "changes": [], "filters": f.as_dict(), "compare": compare, "section": None,
        "chart": None, "calc": None, "route": None, "remembered": [], "guard": {"input": verdict.as_dict(), "tools": []},
    }


def run_copilot(message: str, history: list[dict], f: af.Filters, compare: str, lang: str, user_id: int | None = None) -> Iterator[dict]:
    """The whole request as events: `guard` (a refusal), `route`, then the agents' progress (see agents/progress.py), then
    `done` with the response the frontend has always received."""
    require_ai_key()  # fail before spending a routing call
    turn = Turn(f=f, compare=compare, user_id=user_id)
    ctx = Ctx(f=f, compare=compare, lang=lang, facts=tuple(knowledge.facts_for(user_id)[:30]), docs=knowledge.catalog())
    # The input guardrail, the routing and the language of the message are independent Jev calls: ask all at once.
    with ThreadPoolExecutor(max_workers=3) as pool:
        checking = pool.submit(guard.check_input, message, history, {**f.as_dict(), "compare": compare}, ctx.docs)
        routing = pool.submit(router.route, message, ctx)
        speaking = pool.submit(language.resolve, message, lang)
    spoken = speaking.result()
    lang = spoken.reply  # the agents answer in Indonesian or English, whichever the message was (other languages: English)
    ctx = replace(ctx, lang=lang)
    verdict = checking.result()
    if verdict.action == "block":
        _log(user_id, [verdict.as_dict()])
        yield {"type": "guard", **verdict.as_dict()}
        yield {"type": "done", "response": _blocked(verdict.reason or "off_topic", verdict, f, compare, lang)}
        return
    route = routing.result()
    turn.route = {**route.as_dict(), "language": spoken.as_dict()}
    yield {"type": "route", **turn.route}
    turn.check_tool = lambda tool, sql: guard.check_tool(message, tool, sql, turn.f.as_dict())
    agent = agents.build_copilot(turn, ctx, route)
    messages = [(h["role"], h["content"]) for h in history[-8:] if h.get("role") in ("user", "assistant")]
    answer = None
    # A message in a third language is answered in English: the models like to mirror the user, so say it where it counts most.
    said = message + "\n\n(Answer in English only.)" if spoken.detected == "other" else message
    for event in agents.stream(agent, [*messages, ("user", said)]):
        if event["type"] == "final":
            answer = event["text"]
        else:
            yield event
    _log(user_id, [verdict.as_dict(), *turn.guards])
    yield {
        "type": "done",
        "response": {
            "answer": answer or TOO_MANY_STEPS["id" if lang == "id" else "en"],
            "changes": turn.changes,
            "filters": turn.f.as_dict(),
            "compare": turn.compare,
            "section": turn.section,
            "chart": turn.chart,
            "calc": turn.calc(),
            "route": turn.route,
            "remembered": turn.remembered,
            "guard": {"input": verdict.as_dict(), "tools": turn.guards},
        },
    }


def copilot(message: str, history: list[dict], f: af.Filters, compare: str, lang: str, user_id: int | None = None) -> dict:
    """The same request without the progress: just the response."""
    response: dict = {}
    for event in run_copilot(message, history, f, compare, lang, user_id):
        if event["type"] == "done":
            response = event["response"]
    return response


def _log(user_id: int | None, verdicts: list[dict]) -> None:
    try:
        repository.log_events(user_id, verdicts)
    except Exception:  # noqa: BLE001  a logging failure must not fail the chat
        log.warning("could not store guard events", exc_info=True)
