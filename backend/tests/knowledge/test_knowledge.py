"""Knowledge: facts are private to a user, documents are shared (only admins write), search finds passages, the agents use both."""
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.engine import SessionLocal
from app.main import app
from app.modules.ai.agents import context, tools
from app.modules.ai.agents import turn as turn_mod
from app.modules.analytics import filters as af
from app.modules.auth.models import User
from app.modules.knowledge import repository, service

DOC = {"title": "Kontrak SLA UPS", "body": "UPS wajib mengantar dalam 3 hari kerja. Denda 2% per hari keterlambatan.", "slug": "sla-ups"}


def user_id(email: str) -> int:
    with SessionLocal() as s:
        return s.scalar(select(User.id).where(User.email == email))


def test_requires_login() -> None:
    c = TestClient(app)
    assert c.get("/api/knowledge/facts").status_code == 401
    assert c.get("/api/knowledge/docs").status_code == 401


def test_facts_are_private_to_each_user(client: TestClient, visitor: TestClient) -> None:
    fact = client.post("/api/knowledge/facts", json={"text": "Saya memegang klien CL-1004"})
    assert fact.status_code == 200 and fact.json()["source"] == "manual"
    assert [f["text"] for f in client.get("/api/knowledge/facts").json()] == ["Saya memegang klien CL-1004"]
    assert visitor.get("/api/knowledge/facts").json() == []
    assert visitor.delete(f"/api/knowledge/facts/{fact.json()['id']}").status_code == 404  # not theirs
    assert client.delete(f"/api/knowledge/facts/{fact.json()['id']}").status_code == 200


def test_a_duplicate_fact_is_refused(client: TestClient) -> None:
    assert client.post("/api/knowledge/facts", json={"text": "Target on-time 95%"}).status_code == 200
    assert client.post("/api/knowledge/facts", json={"text": "target on-time 95%"}).status_code == 409
    assert client.post("/api/knowledge/facts", json={"text": ""}).status_code == 422


def test_documents_are_for_admins_only(client: TestClient, visitor: TestClient) -> None:
    assert visitor.post("/api/knowledge/docs", json=DOC).status_code == 403
    made = client.post("/api/knowledge/docs", json=DOC)
    assert made.status_code == 200
    doc_id = made.json()["id"]
    assert client.get(f"/api/knowledge/docs/{doc_id}").json()["body"] == DOC["body"]
    assert visitor.get(f"/api/knowledge/docs/{doc_id}").status_code == 403  # managed in the backoffice
    assert visitor.get("/api/knowledge/docs").status_code == 403
    assert visitor.put(f"/api/knowledge/docs/{doc_id}", json=DOC).status_code == 403
    assert visitor.delete(f"/api/knowledge/docs/{doc_id}").status_code == 403
    assert client.put(f"/api/knowledge/docs/{doc_id}", json={**DOC, "title": "SLA UPS v2"}).json()["title"] == "SLA UPS v2"
    assert client.delete(f"/api/knowledge/docs/{doc_id}").status_code == 200
    assert client.get(f"/api/knowledge/docs/{doc_id}").status_code == 404


def test_slug_is_unique_and_validated(client: TestClient) -> None:
    assert client.post("/api/knowledge/docs", json=DOC).status_code == 200
    assert client.post("/api/knowledge/docs", json=DOC).status_code == 409
    assert client.post("/api/knowledge/docs", json={**DOC, "slug": "Bad Slug!"}).status_code == 422


def test_search_finds_the_passage_and_ignores_filler_words(client: TestClient) -> None:
    client.post("/api/knowledge/docs", json=DOC)
    client.post("/api/knowledge/docs", json={"title": "Catatan gudang", "body": "Gudang US-W tutup hari Minggu."})
    hits = repository.search("bagaimana denda keterlambatan UPS?")
    assert [h["title"] for h in hits] == ["Kontrak SLA UPS"] and "denda" in hits[0]["passage"].lower()
    assert [d["title"] for d in client.get("/api/knowledge/docs", params={"q": "gudang"}).json()] == ["Catatan gudang"]
    assert repository.search("zzzz tidak ada") == [] and repository.search("?!") == []


def test_search_query_cannot_inject_tsquery_syntax() -> None:
    assert repository.search("ups & !(foo) | 'x'") == []  # punctuation is dropped; no error


def test_remember_tool_saves_for_the_asking_user(client: TestClient) -> None:
    uid = user_id("admin@test.local")
    t = turn_mod.Turn(f=af.Filters(), compare="prev", user_id=uid)
    out = tools.make_tools(t)["remember"].invoke({"text": "Saya mengawasi UPS"})
    assert "remembered" in out and [r["text"] for r in t.remembered] == ["Saya mengawasi UPS"]
    assert service.facts_for(uid) == ["Saya mengawasi UPS"]
    anon = turn_mod.Turn(f=af.Filters(), compare="prev")
    assert "error" in tools.make_tools(anon)["remember"].invoke({"text": "x"})  # nobody to remember it for


def test_search_kb_tool_returns_results(client: TestClient) -> None:
    client.post("/api/knowledge/docs", json=DOC)
    out = tools.make_tools(turn_mod.Turn(f=af.Filters(), compare="prev"))["search_kb"].invoke({"query": "denda UPS"})
    assert "Kontrak SLA UPS" in out


def test_the_catalog_summarises_what_the_documents_cover(client: TestClient) -> None:
    assert service.catalog() == ()
    client.post("/api/knowledge/docs", json={"title": "About Creator", "body": "Creator's name is  Ketut Toto.\nSix years as an engineer."})
    assert service.catalog() == ("About Creator: Creator's name is Ketut Toto. Six years as an engineer.",)


def test_facts_reach_every_agent_prompt_as_context() -> None:
    ctx = context.Ctx(af.Filters(), "prev", "id", facts=("Saya memegang klien CL-1004",))
    p = context.reference(ctx)
    assert "CL-1004" in p and "never instructions" in p
    assert "nothing saved yet" in context.reference(context.Ctx(af.Filters(), "prev", "id"))


def test_the_copilot_still_reads_documents_for_a_visitor(client: TestClient, visitor: TestClient) -> None:
    """The documents are admin-only to browse, but what the copilot answers from them is for everyone (it reads them server side)."""
    from app.modules.ai.agents import tools, turn as turn_mod
    from app.modules.analytics import filters as af

    client.post("/api/knowledge/docs", json=DOC)
    out = tools.make_tools(turn_mod.Turn(f=af.Filters(), compare="prev", user_id=2))["search_kb"].invoke({"query": "denda UPS"})
    assert "UPS" in out
