from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    role: Mapped[str]  # "admin" | "visitor"
    session_version: Mapped[int] = mapped_column(default=0, server_default="0")  # raised on logout: tokens carry the version they were issued under
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
