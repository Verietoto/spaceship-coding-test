"""Turns the updates LangGraph streams while the agent team works into the progress events the UI animates.

  {"type": "agent",      "name": "analyst", "task": "..."}          the coordinator deploys a subagent
  {"type": "tool",       "id", "agent": "copilot|analyst|...", "name", "args": {...}}   a tool is called
  {"type": "tool_done",  "id", "ok": bool, "n": int|None, "unit": "rows|orders|widgets|docs"|None}
  {"type": "agent_done", "name"}                                   the subagent's answer is back
  {"type": "final",      "text": str|None}                         the coordinator's answer (None: no more steps)

Only names, a few safe arguments and a row count leave: never SQL text, rows or notes.
"""
import json
from collections.abc import Iterable, Iterator
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

from ...dashboards.schemas import MAX_WIDGETS

SAFE_ARGS = ("by", "section", "period", "year", "start", "end", "region", "warehouse", "carrier", "client", "exclude", "compare", "reset", "title", "type", "query")
COUNTS = {  # tool result key -> what it counts
    "row_count": "rows",
    "orders_in_filter": "orders",
    "widgets": "widgets",
}


def text_of(message: Any) -> str:
    c = message.content
    return c if isinstance(c, str) else "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in c)


def _args(args: dict) -> dict:
    out: dict = {}
    if isinstance(args.get("widgets"), list):  # create_dashboard: the widget titles, never their SQL
        out["widgets"] = [str(w.get("title", ""))[:50] for w in args["widgets"][:MAX_WIDGETS] if isinstance(w, dict)]
    if isinstance(args.get("filters"), list):  # which filters the dashboard gets (their names only)
        out["filters"] = [str(f.get("key", "")) for f in args["filters"][:5] if isinstance(f, dict)]
    for key in SAFE_ARGS:
        v = args.get(key)
        if v is None:
            continue
        out[key] = [str(x)[:40] for x in v[:4]] if isinstance(v, list) else v if isinstance(v, bool | int | float) else str(v)[:60]
    return out


def _result(name: str, content: Any) -> dict:
    """ok, and how many rows/orders/widgets/documents the tool returned, from its JSON result."""
    none = {"ok": True, "n": None, "unit": None}
    try:
        data = json.loads(content if isinstance(content, str) else str(content))
    except ValueError:
        return none
    if not isinstance(data, dict):
        return none
    if "error" in data:
        return {"ok": False, "n": None, "unit": None}
    ok = data.get("ok") is not False  # create_dashboard says ok: false when some widget's SQL failed
    if name == "search_kb":
        return {"ok": True, "n": len(data.get("results") or []), "unit": "docs"}
    for key, unit in COUNTS.items():
        if isinstance(data.get(key), int):
            return {"ok": ok, "n": data[key], "unit": unit}
    if isinstance(data.get("rows"), list):
        return {"ok": True, "n": len(data["rows"]), "unit": "rows"}
    return {**none, "ok": ok}


def events(chunks: Iterable[tuple[tuple, dict]]) -> Iterator[dict]:
    """`chunks` are (namespace, update) pairs from `agent.stream(..., stream_mode="updates", subgraphs=True)`.

    The coordinator streams under an empty namespace; each subagent under its own `tools:<id>` namespace. The name of
    a subagent comes from the `task` call that started it, matched by order.
    ponytail: matched by order, so two subagents running in parallel and finishing out of order could swap names; the
    coordinator delegates one at a time today.
    """
    pending: list[str] = []  # subagents started by `task` calls, not yet seen running
    tasks: dict[str, str] = {}  # task tool-call id -> subagent name
    names: dict[str, str] = {}  # stream namespace -> subagent name
    final: str | None = None
    for ns, update in chunks:
        if ns and ns[0] not in names:
            names[ns[0]] = pending.pop(0) if pending else "subagent"
        agent = names[ns[0]] if ns else "copilot"
        for payload in update.values():
            messages = payload.get("messages") if isinstance(payload, dict) else None
            for m in messages if isinstance(messages, list) else []:
                if isinstance(m, AIMessage):
                    for c in m.tool_calls:
                        if c["name"] == "task":
                            name = str(c["args"].get("subagent_type") or "subagent")
                            tasks[c["id"]] = name
                            pending.append(name)
                            yield {"type": "agent", "name": name, "task": str(c["args"].get("description") or "")[:160]}
                        else:
                            yield {"type": "tool", "id": c["id"], "agent": agent, "name": c["name"], "args": _args(c["args"])}
                    if not m.tool_calls and not ns:
                        final = text_of(m)
                elif isinstance(m, ToolMessage):
                    if m.tool_call_id in tasks:
                        yield {"type": "agent_done", "name": tasks[m.tool_call_id]}
                    else:
                        yield {"type": "tool_done", "id": m.tool_call_id, **_result(m.name or "", m.content)}
    yield {"type": "final", "text": final}
