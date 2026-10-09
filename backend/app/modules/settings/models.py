from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class AppSetting(Base):
    """One backoffice setting. Keys are namespaced ("ai.model"); a secret's value is encrypted (core/secrets.py)."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str]
    updated_by: Mapped[str | None]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
