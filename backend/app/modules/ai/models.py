from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base
from ..auth import models as _auth  # noqa: F401  (the foreign key needs `users` on the metadata)


class GuardEvent(Base):
    """A guardrail that blocked or flagged something; read by the admin pages later."""

    __tablename__ = "guard_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    stage: Mapped[str]  # input | tool | output
    action: Mapped[str]  # warn | block
    reason: Mapped[str | None]
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
