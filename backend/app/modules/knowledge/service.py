"""What other modules (the AI agents) may use from knowledge: no HTTP, no ORM."""
from . import repository


def facts_for(user_id: int | None) -> list[str]:
    return [f["text"] for f in repository.list_facts(user_id)] if user_id else []


def catalog() -> tuple[str, ...]:
    """What the team documents cover, for Jev: so a question about a person or term they describe is not taken for off topic."""
    try:
        return tuple(repository.snippets())
    except Exception:  # noqa: BLE001  a missing catalog only makes Jev less informed
        return ()


def remember(user_id: int | None, text: str, source: str = "chat") -> dict:
    text = text.strip()[:500]
    if not user_id or not text:
        return {"error": "nothing to remember"}
    fact = repository.add_fact(user_id, text, source)
    return {"remembered": fact} if fact else {"error": f"already remembered, or the limit of {repository.MAX_FACTS} facts is reached"}


def search_kb(query: str) -> dict:
    return {"results": repository.search(query)}
