"""Clarifying questions before the Builder builds: ask until the request is clear enough, at most MAX_ROUNDS times.

Stateless: the browser sends the prompt and every answer so far, and gets one of
  {"status": "ready"}                                   build now
  {"status": "ask", "question", "options", "round", "max"}   one more question (the user may also type their own answer)
  {"status": "refused", "message"}                      not a dashboard request (same input guardrail as the Copilot)

Every build also asks, once, which chart type the user wants (fixed options, the question names the case); that question is
saved a round of the budget and comes last, even when the request was already clear.

Jev is the quick gate (is the request already clear?). Only when it is not, one LLM call writes the next question with
options from the real data. Anything that goes wrong (no key, bad answer from the model) means "ready": building a
dashboard beats getting stuck in questions.
"""
import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_typesafe import Noul

from ...core.errors import require_ai_key
from ..analytics import filters as af
from . import guard, language, llm
from .agents import router
from .agents.context import Ctx, reference

MAX_ROUNDS = 3  # questions in all, the chart-type one included
CHART_OPTIONS = {
    "id": ["Bar chart (perbandingan)", "Line chart (tren)", "Pie chart (porsi)", "Tabel", "Biar AI yang memilih"],
    "en": ["Bar chart (compare)", "Line chart (trend)", "Pie chart (share)", "Table", "Let the AI choose"],
}
CHART_FALLBACK = {"id": "Mau divisualkan dengan tipe grafik apa?", "en": "Which chart type should it use?"}
# A chart type already named by the user (or picked from the options above): bar, line, pie, table, the other chart types and their Indonesian names.
CHART_WORD = re.compile(r"\b(bar|line|pie|donut|table|tabel|batang|garis|lingkaran|stacked|bertumpuk|horizontal|area|histogram|combo|gabungan|gauge|heatmap|peta panas|scatter|sebar|funnel|treemap|radar|sankey|(let the ai|biar ai))\b", re.I)
CLEAR_AT = 0.6  # Jev's confidence that the request is clear enough to build; measured: specific requests score >= 0.72, vague ones <= 0.32

WHAT_WE_CAN_DO = (
    "A dashboard builder for logistics order data. It can measure order counts, order value, delay rate, delivered rate, lead time "
    "(median, P90), orders over the 7-day SLA, stuck and exception orders and value at risk; split them by carrier, region, "
    "warehouse, client or month; and scope them to a period or to chosen carriers, regions, warehouses or clients. The dashboard can also offer filters (period, carrier, region, warehouse, client) that its viewers change."
)


def brief(prompt: str, answers: list[dict]) -> str:
    """What the builder agent is given: the request plus what the user answered."""
    if not answers:
        return prompt
    return prompt + "\n\nThe user clarified:\n" + "\n".join(f"- {a['question']} -> {a['answer']}" for a in answers)


def _jev() -> Any | None:
    return router.jev_client() if router.TYPESAFE_API_KEY else None


def _is_clear(text: str) -> float | None:
    """Jev's confidence that the request is specific enough to build as it is; None when it cannot say."""
    client = _jev()
    if client is None:
        return None
    # Two angles, the higher wins: one question asking "is it clear?" at once scored specific and vague requests alike.
    questions = {
        "names_a_measure": Noul(instructions="Does the request name a specific measure, such as delay rate, SLA, lead time, order count, order value, stuck orders or value at risk?"),
        "is_specific": Noul(instructions="Is the request specific, rather than just asking for 'a dashboard', 'performance', 'an overview' or 'a summary'?"),
    }
    try:
        scores = client.invoke({"state": {"context": WHAT_WE_CAN_DO, "request": text}, "questions": questions}).nouls
        return max(float(scores["names_a_measure"].noul), float(scores["is_specific"].noul))
    except Exception:  # noqa: BLE001  Jev failing means the LLM decides
        return None


def _next_question(text: str, lang: str) -> dict | None:
    """One LLM call: the next question with 2-4 options, or None when it says ready or answers badly."""
    ctx = Ctx(f=af.Filters(), compare="none", lang=lang)
    system = f"""You help a user define a dashboard for Spaceship's logistics data before it is built. Write in {ctx.language} only, even when the user writes in another language.

{reference(ctx)}

What the builder can do: {WHAT_WE_CAN_DO}

Decide whether the request (with the user's earlier answers) is clear enough to design a useful dashboard.
- If it already says what to measure and for which scope, answer {{"ready": true}}.
- Otherwise ask ONE question, the one that most changes the dashboard first: what to measure, then the scope (all data or a period/carrier/region/warehouse/client), then how to split it, then which filters the viewers should get (options like 'Period and carrier', 'Period and region', 'No filters'). Never repeat something already answered.
- Give 2-4 short options (under 8 words each), using real values from the valid values above when they fit, e.g. carriers, regions or periods.
Answer with JSON only: {{"ready": true}} or {{"ready": false, "question": "...", "options": ["...", "..."]}}"""
    reply = llm.chat_model().invoke([SystemMessage(content=system), HumanMessage(content=text)])
    raw = reply.content if isinstance(reply.content, str) else "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in reply.content)
    found = re.search(r"\{.*\}", raw, re.S)  # models sometimes wrap the JSON in prose
    try:
        data = json.loads(found.group(0)) if found else {}
    except ValueError:
        return None
    options = [str(o).strip()[:60] for o in data.get("options") or [] if str(o).strip()]
    question = str(data.get("question") or "").strip()[:200]
    if data.get("ready") or not question or not 2 <= len(options) <= 4:
        return None
    return {"question": question, "options": options}


def names_chart_type(prompt: str, answers: list[dict]) -> bool:
    """Has the user already said how to visualise it? Only their own words count (the request and their answers)."""
    return bool(CHART_WORD.search(" ".join([prompt, *(a["answer"] for a in answers)])))


def _chart_question(text: str, lang: str) -> str:
    """One sentence that names the case ("For delay rate per carrier, how should it look?"); a fixed one when the model fails."""
    ctx = Ctx(f=af.Filters(), compare="none", lang=lang)
    system = (
        f"A user is defining a dashboard. Write in {ctx.language} only. Ask ONE short question (under 25 words) about which chart type "
        "to use for the main thing they want to see, naming that thing, e.g. 'For delay rate per carrier, how should it be shown?'. "
        "Do not list the options. Answer with the question only."
    )
    try:
        reply = llm.chat_model().invoke([SystemMessage(content=system), HumanMessage(content=text)])
        raw = reply.content if isinstance(reply.content, str) else "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in reply.content)
        question = " ".join(raw.split())[:200]
    except Exception:  # noqa: BLE001  no model, no key: the fixed question still works
        return CHART_FALLBACK[lang if lang in CHART_FALLBACK else "id"]
    return question if question.endswith("?") else CHART_FALLBACK[lang if lang in CHART_FALLBACK else "id"]


def clarify(prompt: str, answers: list[dict], lang: str) -> dict:
    require_ai_key()
    lang = language.resolve(prompt, lang).reply  # the question follows the language of the request
    text = brief(prompt, answers)
    verdict = guard.check_input(text)  # every round: a typed answer is user text too
    if verdict.action == "block":
        return {"status": "refused", "message": guard.reply(verdict.reason or "off_topic", lang)}
    chart_due = not names_chart_type(prompt, answers)
    if len(answers) < MAX_ROUNDS - chart_due:  # one round is kept for the chart type
        clear = _is_clear(text)
        if clear is None or clear < CLEAR_AT:
            asked = _next_question(text, lang)
            if asked is not None:
                return {"status": "ask", **asked, "round": len(answers) + 1, "max": MAX_ROUNDS}
    if chart_due and len(answers) < MAX_ROUNDS:
        options = CHART_OPTIONS[lang if lang in CHART_OPTIONS else "id"]
        return {"status": "ask", "question": _chart_question(text, lang), "options": options, "round": len(answers) + 1, "max": MAX_ROUNDS}
    return {"status": "ready"}
