"""User facts and knowledge-base documents."""
import re

from sqlalchemy import delete, func, select, text

from ...db.engine import SessionLocal, iso
from .models import KbDoc, UserFact

MAX_FACTS = 50  # per user


def _fact(r: UserFact) -> dict:
    return {"id": r.id, "text": r.text, "source": r.source, "created_at": iso(r.created_at)}


def _doc(r: KbDoc, body: bool = True) -> dict:
    d = {"id": r.id, "slug": r.slug, "title": r.title, "updated_at": iso(r.updated_at), "created_by": r.created_by}
    return {**d, "body": r.body} if body else d


def list_facts(user_id: int) -> list[dict]:
    with SessionLocal() as s:
        return [_fact(r) for r in s.scalars(select(UserFact).where(UserFact.user_id == user_id).order_by(UserFact.id))]


def add_fact(user_id: int, fact: str, source: str) -> dict | None:
    """None when the user is at the limit or already has this fact."""
    with SessionLocal.begin() as s:
        mine = s.scalars(select(UserFact).where(UserFact.user_id == user_id)).all()
        if len(mine) >= MAX_FACTS or any(f.text.lower() == fact.lower() for f in mine):
            return None
        r = UserFact(user_id=user_id, text=fact, source=source)
        s.add(r)
        s.flush()
        s.refresh(r)
        return _fact(r)


def delete_fact(user_id: int, fact_id: int) -> bool:
    with SessionLocal.begin() as s:
        return s.execute(delete(UserFact).where(UserFact.id == fact_id, UserFact.user_id == user_id)).rowcount > 0


def list_docs(q: str | None = None) -> list[dict]:
    with SessionLocal() as s:
        stmt = select(KbDoc).order_by(KbDoc.title, KbDoc.id)
        if q and (query := _or_query(q)):
            stmt = stmt.where(KbDoc.tsv.op("@@")(func.to_tsquery("simple", query)))
        return [_doc(r, body=False) for r in s.scalars(stmt)]


def snippets(limit: int = 15, chars: int = 160) -> list[str]:
    """"Title: first words of the body" for the most recently edited documents: a map of what the team documents cover."""
    with SessionLocal() as s:
        rows = s.execute(select(KbDoc.title, func.left(KbDoc.body, chars)).order_by(KbDoc.updated_at.desc(), KbDoc.id.desc()).limit(limit)).all()
    return [f"{t}: {' '.join(b.split())}" for t, b in rows]


def get_doc(doc_id: int) -> dict | None:
    with SessionLocal() as s:
        r = s.get(KbDoc, doc_id)
        return _doc(r) if r else None


def get_by_slug(slug: str) -> dict | None:
    with SessionLocal() as s:
        r = s.scalar(select(KbDoc).where(KbDoc.slug == slug))
        return _doc(r) if r else None


def save_doc(title: str, body: str, slug: str | None, user: str, doc_id: int | None = None) -> dict | None:
    """Create (doc_id None) or replace; None when `doc_id` does not exist."""
    with SessionLocal.begin() as s:
        if doc_id is None:
            r = KbDoc(created_by=user)
            s.add(r)
        elif (r := s.get(KbDoc, doc_id)) is None:
            return None
        r.title, r.body, r.slug, r.updated_at = title, body, slug, func.now()
        s.flush()
        s.refresh(r)
        return _doc(r)


def delete_doc(doc_id: int) -> bool:
    with SessionLocal.begin() as s:
        return s.execute(delete(KbDoc).where(KbDoc.id == doc_id)).rowcount > 0


def _or_query(q: str) -> str:
    """'SLA UPS keterlambatan' -> 'sla | ups | keterlambatan' (words only, so it is a safe tsquery)."""
    return " | ".join(dict.fromkeys(w.lower() for w in re.findall(r"\w{3,}", q)))


def search(q: str, limit: int = 3) -> list[dict]:
    """Best-matching documents with the passage that matched."""
    query = _or_query(q)
    if not query:
        return []
    sql = text(
        """
        SELECT id, title, slug,
               ts_headline('simple', body, to_tsquery('simple', :q), 'MaxWords=70, MinWords=25, MaxFragments=2, FragmentDelimiter=" ... "') AS passage
        FROM kb_docs
        WHERE tsv @@ to_tsquery('simple', :q)
        ORDER BY ts_rank(tsv, to_tsquery('simple', :q)) DESC
        LIMIT :n
        """
    )
    with SessionLocal() as s:
        return [dict(r) for r in s.execute(sql, {"q": query, "n": limit}).mappings()]
