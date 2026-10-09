"""Knowledge: per-user facts (everyone, their own) and the shared documents (managed in the backoffice, so admin only; the Copilot
reads them for everyone, server side)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError

from ...core.security import SessionUser, current_user, logged_in, require_admin
from . import repository
from .schemas import DocIn, FactIn

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"], dependencies=[logged_in])


@router.get("/facts")
def facts(user: SessionUser = Depends(current_user)) -> list[dict]:
    return repository.list_facts(user.id)


@router.post("/facts")
def add_fact(body: FactIn, user: SessionUser = Depends(current_user)) -> dict:
    fact = repository.add_fact(user.id, body.text.strip(), "manual")
    if fact is None:
        raise HTTPException(409, "already saved, or the limit is reached")
    return fact


@router.delete("/facts/{fact_id}")
def remove_fact(fact_id: int, user: SessionUser = Depends(current_user)) -> dict:
    if not repository.delete_fact(user.id, fact_id):
        raise HTTPException(404, "fact not found")
    return {}


@router.get("/docs", dependencies=[Depends(require_admin)])
def docs(q: str | None = None) -> list[dict]:
    return repository.list_docs(q)


@router.get("/docs/{doc_id}", dependencies=[Depends(require_admin)])
def doc(doc_id: int) -> dict:
    if (d := repository.get_doc(doc_id)) is None:
        raise HTTPException(404, "document not found")
    return d


def _save(body: DocIn, user: SessionUser, doc_id: int | None = None) -> dict:
    try:
        d = repository.save_doc(body.title.strip(), body.body, body.slug, user.email, doc_id)
    except IntegrityError as e:
        raise HTTPException(409, "that slug is already used") from e
    if d is None:
        raise HTTPException(404, "document not found")
    return d


@router.post("/docs")
def add_doc(body: DocIn, user: SessionUser = Depends(require_admin)) -> dict:
    return _save(body, user)


@router.put("/docs/{doc_id}")
def update_doc(doc_id: int, body: DocIn, user: SessionUser = Depends(require_admin)) -> dict:
    return _save(body, user, doc_id)


@router.delete("/docs/{doc_id}", dependencies=[Depends(require_admin)])
def remove_doc(doc_id: int) -> dict:
    if not repository.delete_doc(doc_id):
        raise HTTPException(404, "document not found")
    return {}
