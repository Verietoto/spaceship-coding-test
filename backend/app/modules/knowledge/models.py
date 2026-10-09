from datetime import datetime

from sqlalchemy import Computed, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base
from ..auth import models as _auth  # noqa: F401  (the foreign key needs `users` on the metadata)


class UserFact(Base):
    """Something the copilot should know about one user ("I watch client CL-1004")."""

    __tablename__ = "user_facts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str]
    source: Mapped[str]  # "manual" | "chat"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KbDoc(Base):
    """A business document shared by the whole team (SLA terms, KPI definitions, the dashboard's author...)."""

    __tablename__ = "kb_docs"
    __table_args__ = (Index("kb_docs_tsv_idx", "tsv", postgresql_using="gin"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str | None] = mapped_column(unique=True)  # well-known docs, e.g. "about-author"
    title: Mapped[str]
    body: Mapped[str]
    created_by: Mapped[str | None]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    tsv: Mapped[str] = mapped_column(TSVECTOR, Computed("to_tsvector('simple', title || ' ' || body)", persisted=True))
