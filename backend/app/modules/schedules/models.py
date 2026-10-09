from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    frequency: Mapped[str]  # weekly | monthly
    recipients: Mapped[list[str]] = mapped_column(JSONB)
    contents: Mapped[list[str]] = mapped_column(JSONB)
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_by: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
