from pydantic import BaseModel, Field


class TourSeen(BaseModel):
    version: int = Field(ge=1, le=99)  # the tour version the account just finished or skipped


class Login(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)  # a hash is slow on purpose: do not let anyone feed it megabytes
