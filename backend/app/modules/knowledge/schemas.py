from pydantic import BaseModel, Field


class FactIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class DocIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=50_000)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,40}$")
