"""AI Builder: one sentence (plus the answers to clarifying questions) -> plan + dashboard draft. The builder subagent runs on
its own and tests each widget's SQL."""
import json
from collections.abc import Iterator

from ...core.errors import require_ai_key
from ..analytics import filters as af
from . import agents, guard, language
from .agents.context import Ctx
from .agents.turn import Turn
from .clarify import brief


def _turn(lang: str) -> tuple[Turn, Ctx]:
    turn = Turn(f=af.Filters(), compare="none")
    return turn, Ctx(f=turn.f, compare="none", lang=lang)


def refine_brief(change: str, draft: dict) -> str:
    """What the builder is given to change a draft: the draft as it stands and what the user now asks."""
    return (
        f"Current dashboard draft (JSON):\n{json.dumps(draft, ensure_ascii=False)}\n\n"
        f"The user asks to change it: {change}\n"
        "Change only what was asked and keep everything else as it is, then call create_dashboard with the complete new dashboard."
    )


def _text(prompt: str, answers: list[dict] | None, draft: dict | None) -> str:
    return refine_brief(prompt, draft) if draft else brief(prompt, answers or [])


def _missing(turn: Turn, said: str | None) -> ValueError:
    """The build ended without a draft: say why (the last refusal of create_dashboard, or what the model answered instead)."""
    why = " ".join((turn.dashboard_error or said or "").split())[:300]
    return ValueError(f"The Builder did not draft a dashboard: {why}" if why else "The Builder did not draft a dashboard.")


def build_dashboard(prompt: str, lang: str, answers: list[dict] | None = None, draft: dict | None = None) -> dict:
    require_ai_key()
    lang = language.resolve(prompt, lang).reply
    turn, ctx = _turn(lang)
    said = agents.run(agents.build_builder(turn, ctx), [("user", _text(prompt, answers, draft))])
    if turn.dashboard is None:
        raise _missing(turn, said)
    return turn.dashboard  # widgets are already rendered (rows or error each)


def stream_build(prompt: str, lang: str, answers: list[dict] | None = None, draft: dict | None = None) -> Iterator[dict]:
    """The same build as progress events: the Builder is deployed, its tools run (each widget's SQL is tested), then `done`
    with the draft. A request that is not about dashboards ends with `guard` and `refused` instead."""
    require_ai_key()
    lang = language.resolve(prompt, lang).reply  # titles and the plan follow the language of the request
    # typed answers reach the model too; a short change ("make it a bar") is judged as a change to this dashboard, not alone
    verdict = guard.check_input(f"Change to the dashboard draft '{draft['title']}': {prompt}" if draft else brief(prompt, answers or []))
    if verdict.action == "block":
        yield {"type": "guard", **verdict.as_dict()}
        yield {"type": "refused", "message": guard.reply(verdict.reason or "off_topic", lang)}
        return
    turn, ctx = _turn(lang)
    yield {"type": "agent", "name": "builder", "task": prompt[:160]}
    said = None
    for event in agents.stream(agents.build_builder(turn, ctx), [("user", _text(prompt, answers, draft))]):
        if event["type"] == "final":
            said = event.get("text")
            continue
        if event["type"] == "tool":
            event["agent"] = "builder"  # the standalone builder has no coordinator: its tools hang under its own card
        yield event
    yield {"type": "agent_done", "name": "builder"}
    if turn.dashboard is None:
        if said and said.strip() and not turn.dashboard_error:
            yield {"type": "message", "text": said.strip()}  # the Builder answered or asked something instead of drafting: show it as it is, not as an error
            return
        raise _missing(turn, said)
    yield {"type": "done", "dashboard": turn.dashboard}
