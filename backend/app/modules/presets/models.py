from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class FilterPreset(Base):
    __tablename__ = "filter_presets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB)  # Filters.as_dict() plus "compare"
    created_by: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
