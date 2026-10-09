"""Jev routing: what gets loaded for which request, and that any doubt or failure loads everything."""
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

from app.modules.ai.agents import router
from app.modules.ai.agents.context import Ctx
from app.modules.analytics import filters as af

CTX = Ctx(af.Filters(), "prev", "en")


def jev(needs: dict | None = None, changes: float = 0.0, kb: float = 0.0, intent: str = "question", confidence: float = 0.9) -> NS:
    """A stand-in for TypeSafeClassifier returning fixed answers."""
    nouls = {f"needs_{n}": NS(noul=0.0) for n in ("analyst", "charter", "builder", "forecaster")}
    nouls |= {f"needs_{n}": NS(noul=p) for n, p in (needs or {}).items()}
    nouls["changes_view"] = NS(noul=changes)
    nouls["needs_kb"] = NS(noul=kb)
    resp = NS(nouls=nouls, choices={"intent": NS(choice=intent, confidence=confidence)})
    return NS(invoke=lambda payload: resp, payload=None)


def test_questions_are_built_from_the_registry() -> None:
    qs = router.questions()
    assert set(qs) == {"needs_analyst", "needs_charter", "needs_builder", "needs_forecaster", "changes_view", "needs_kb", "intent"}
    assert set(qs["intent"].criteria) == {"view_only", "question", "chart", "build", "forecast", "explain", "knowledge", "out_of_scope"}


def test_view_change_loads_no_subagents() -> None:
    r = router.route("fokus ke UPS di Q4", CTX, jev(changes=0.95, intent="view_only"))
    assert (r.source, r.subagents, r.tools, r.intent) == ("jev", (), router.VIEW_TOOLS, "view_only")


def test_a_chart_request_loads_only_the_charter() -> None:
    r = router.route("grafik delay per region", CTX, jev(needs={"charter": 0.92}, intent="chart"))
    assert r.subagents == ("charter",) and r.tools == () and r.scores["needs_charter"] == 0.92


def test_filter_plus_question_loads_the_analyst_and_view_tools() -> None:
    r = router.route("UPS di Q4, berapa delay?", CTX, jev(needs={"analyst": 0.9}, changes=0.8, intent="question"))
    assert r.subagents == ("analyst",) and r.tools == router.VIEW_TOOLS


def test_intent_alone_is_enough_to_pick_the_matching_subagent() -> None:
    assert router.route("buatkan dashboard", CTX, jev(intent="build")).subagents == ("builder",)


def test_the_knowledge_base_is_loaded_only_when_jev_says_so() -> None:
    assert router.route("SLA UPS berapa?", CTX, jev(intent="question", kb=0.9)).tools == router.KB_TOOLS
    assert router.route("berapa order?", CTX, jev(intent="question", kb=0.2)).tools == ()


def test_a_knowledge_question_loads_only_the_knowledge_tool() -> None:
    r = router.route("apa isi kontrak SLA UPS?", CTX, jev(intent="knowledge"))
    assert (r.source, r.subagents, r.tools) == ("jev", (), router.KB_TOOLS)


def test_explaining_a_metric_loads_nothing() -> None:
    r = router.route("apa arti P90?", CTX, jev(intent="explain"))
    assert (r.source, r.subagents, r.tools, r.intent) == ("jev", (), (), "explain")


def test_out_of_scope_loads_nothing() -> None:
    r = router.route("what is the weather", CTX, jev(intent="out_of_scope"))
    assert (r.subagents, r.tools, r.source) == ((), (), "jev")


def test_low_confidence_loads_everything() -> None:
    r = router.route("hmm", CTX, jev(intent="question", confidence=0.4))
    assert r.source == "fallback" and "low confidence" in r.reason
    assert r.subagents == ("analyst", "charter", "builder", "forecaster") and r.tools == (*router.VIEW_TOOLS, *router.KB_TOOLS)


def test_threshold_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(router, "JEV_THRESHOLD", 0.95)
    assert router.route("x", CTX, jev(needs={"analyst": 0.9}, intent="question", confidence=0.9)).source == "fallback"


def test_jev_failure_never_fails_the_request() -> None:
    def boom(payload: object) -> None:
        raise TimeoutError("slow")

    r = router.route("anything", CTX, NS(invoke=boom))
    assert r.source == "fallback" and r.reason == "TimeoutError" and len(r.subagents) == 4


def test_without_a_key_routing_is_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(router, "TYPESAFE_API_KEY", "")
    r = router.route("anything", CTX)
    assert r.source == "fallback" and "TYPESAFE_API_KEY" in r.reason


def test_route_is_serialisable_for_the_response() -> None:
    d = router.route("x", CTX, jev(needs={"charter": 0.9}, intent="chart")).as_dict()
    assert d["subagents"] == ["charter"] and d["source"] == "jev" and isinstance(d["scores"], dict)


def test_a_long_history_is_clipped_not_refused(client: TestClient, fake_model) -> None:  # noqa: ANN001
    from langchain_core.messages import AIMessage

    fake_model([AIMessage(content="ok")])
    history = [{"role": "assistant" if i % 2 else "user", "content": "x" * 9000} for i in range(30)]  # past both limits
    r = client.post("/api/copilot", json={"message": "hi", "history": history})
    assert r.status_code == 200


def test_the_history_schema_keeps_the_latest_and_clips_each_message() -> None:
    from app.modules.ai.schemas import MAX_CONTENT, MAX_HISTORY, CopilotRequest

    req = CopilotRequest(message="hi", history=[{"role": "user", "content": f"{i}" + "y" * 9000} for i in range(30)])
    assert len(req.history) == MAX_HISTORY and req.history[-1].content.startswith("29")
    assert all(len(m.content) <= MAX_CONTENT for m in req.history)
