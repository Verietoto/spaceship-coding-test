"""Progress events: what the UI is told while the agent team works, in what order, and that nothing sensitive leaves."""
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, ToolMessage

from app.modules.ai import copilot as ai
from app.modules.ai import guard
from app.modules.ai.agents import progress
from app.modules.analytics import filters as af
from tests.ai.test_guard import FakeJev
from tests.conftest import call


def tool_call(name: str, args: dict, id: str) -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": id}])


def test_events_from_a_delegated_question() -> None:
    chunks = [
        ((), {"model": {"messages": [tool_call("set_filters", {"carrier": ["UPS"], "period": "Q4"}, "t1")]}}),
        ((), {"tools": {"messages": [ToolMessage(content=json.dumps({"filters": {}, "orders_in_filter": 15}), name="set_filters", tool_call_id="t1")]}}),
        ((), {"model": {"messages": [tool_call("task", {"description": "How many UPS orders?", "subagent_type": "analyst"}, "t2")]}}),
        (("tools:abc",), {"model": {"messages": [tool_call("run_sql", {"sql": "SELECT secret FROM orders", "formulas": []}, "t3")]}}),
        (("tools:abc",), {"tools": {"messages": [ToolMessage(content=json.dumps({"row_count": 46, "rows": [{"secret": 1}]}), name="run_sql", tool_call_id="t3")]}}),
        (("tools:abc",), {"model": {"messages": [AIMessage(content="subagent answer")]}}),
        ((), {"tools": {"messages": [ToolMessage(content="subagent answer", name="task", tool_call_id="t2")]}}),
        ((), {"model": {"messages": [AIMessage(content="Final answer")]}}),
    ]
    got = list(progress.events(chunks))
    assert [e["type"] for e in got] == ["tool", "tool_done", "agent", "tool", "tool_done", "agent_done", "final"]
    assert got[0] == {"type": "tool", "id": "t1", "agent": "copilot", "name": "set_filters", "args": {"carrier": ["UPS"], "period": "Q4"}}
    assert got[1] == {"type": "tool_done", "id": "t1", "ok": True, "n": 15, "unit": "orders"}
    assert got[2] == {"type": "agent", "name": "analyst", "task": "How many UPS orders?"}
    assert (got[3]["agent"], got[3]["name"]) == ("analyst", "run_sql")  # the tool is attributed to the deployed subagent
    assert got[3]["args"] == {}  # the SQL text never leaves
    assert (got[4]["n"], got[4]["unit"]) == (46, "rows") and "secret" not in json.dumps(got)
    assert got[5] == {"type": "agent_done", "name": "analyst"}
    assert got[6] == {"type": "final", "text": "Final answer"}  # the subagent's own text is not the final answer


def test_a_tool_error_is_not_ok() -> None:
    chunks = [((), {"tools": {"messages": [ToolMessage(content=json.dumps({"error": "invalid carrier"}), name="set_filters", tool_call_id="x")]}})]
    assert next(progress.events(chunks)) == {"type": "tool_done", "id": "x", "ok": False, "n": None, "unit": None}


def test_knowledge_results_are_counted_as_documents() -> None:
    chunks = [((), {"tools": {"messages": [ToolMessage(content=json.dumps({"results": [{"title": "a"}, {"title": "b"}]}), name="search_kb", tool_call_id="k")]}})]
    assert next(progress.events(chunks)) == {"type": "tool_done", "id": "k", "ok": True, "n": 2, "unit": "docs"}


def test_run_copilot_streams_the_team_at_work(fake_model) -> None:  # noqa: ANN001
    fake_model([
        call("set_filters", {"carrier": ["UPS"], "period": "Q4"}, "c1"),  # distinct ids, like the real ones
        call("task", {"description": "How many orders?", "subagent_type": "analyst"}, "c2"),
        call("get_kpis", {}, "c3"),
        AIMessage(content="UPS had 15 orders in Q4."),
        AIMessage(content="UPS di Q4: 15 order."),
    ])
    got = list(ai.run_copilot("Fokus ke UPS di Q4, berapa order?", [], af.Filters(), "prev", "id"))
    kinds = [(e["type"], e.get("agent") or e.get("name")) for e in got]
    assert kinds == [
        ("route", None), ("tool", "copilot"), ("tool_done", None), ("agent", "analyst"),
        ("tool", "analyst"), ("tool_done", None), ("agent_done", "analyst"), ("done", None),
    ]
    assert got[1]["name"] == "set_filters" and got[4]["name"] == "get_kpis"
    assert got[-1]["response"]["answer"] == "UPS di Q4: 15 order."


def test_a_refusal_streams_guard_then_done_without_the_llm(fake_model, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: ANN001
    model = fake_model([])
    monkeypatch.setattr(guard, "_client", lambda: FakeJev("off_topic", 0.95))
    got = list(ai.run_copilot("buatkan kode python", [], af.Filters(), "prev", "id"))
    assert [e["type"] for e in got] == ["guard", "done"]
    assert (got[0]["stage"], got[0]["action"], got[0]["reason"]) == ("input", "block", "off_topic")
    assert model.seen == []


def lines(r) -> list[dict]:  # noqa: ANN001
    return [json.loads(line) for line in r.text.splitlines() if line]


def test_the_stream_endpoint(client: TestClient, fake_model) -> None:  # noqa: ANN001
    fake_model([AIMessage(content="halo")])
    r = client.post("/api/copilot/stream", json={"message": "halo"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/x-ndjson")
    got = lines(r)
    assert [e["type"] for e in got] == ["route", "done"]
    assert got[-1]["response"]["answer"] == "halo" and set(got[-1]["response"]) >= {"answer", "filters", "guard", "remembered"}


def test_the_stream_needs_login() -> None:
    from app.main import app

    assert TestClient(app).post("/api/copilot/stream", json={"message": "hi"}).status_code == 401


def test_an_unconfigured_ai_is_an_error_event(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    got = lines(client.post("/api/copilot/stream", json={"message": "halo"}))
    assert got == [{"type": "error", "status": 503, "message": "AI is not configured (no API key: set it in the Backoffice, or OPENAI_API_KEY)"}]
