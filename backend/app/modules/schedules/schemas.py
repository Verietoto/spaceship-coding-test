import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class ScheduleIn(BaseModel):
    frequency: Literal["weekly", "monthly"]
    recipients: list[str] = Field(min_length=1, max_length=20)
    contents: list[Literal["summary", "kpis", "risk", "csv"]] = Field(min_length=1)
    filters: dict[str, Any] = {}

    @field_validator("recipients")
    @classmethod
    def emails(cls, v: list[str]) -> list[str]:
        bad = [e for e in v if not EMAIL_RE.fullmatch(e.strip())]
        if bad:
            raise ValueError(f"invalid email: {bad[0]}")
        return [e.strip() for e in v]
