from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    user: str = Field(min_length=1)
    pass_: str = Field(min_length=1, alias="pass")
    secret: str = Field(min_length=1)
