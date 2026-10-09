from typing import Literal

from pydantic import BaseModel, Field, field_validator

MODEL_NAME = r"^[\w.:/-]{1,80}$"


class AiIn(BaseModel):
    provider: Literal["openai", "openrouter"]
    model: str = Field(pattern=MODEL_NAME)
    subagent_model: str = Field(default="", pattern=r"^[\w.:/-]{0,80}$")  # empty = the subagents use `model`
    api_key: str | None = Field(default=None, max_length=300)  # empty or missing = keep the key in use

    @field_validator("api_key")
    @classmethod
    def _blank_is_none(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None
