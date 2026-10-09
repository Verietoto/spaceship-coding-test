from typing import Any, Literal

from pydantic import BaseModel, Field


class PresetIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    filters: dict[str, Any]
    compare: Literal["prev", "base", "none"] = "prev"
