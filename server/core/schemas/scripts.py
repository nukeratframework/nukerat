from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, field_validator, model_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


ScriptTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class CreateScriptRequest(BaseModel):
    name: str = Field(min_length=1)
    content: str = Field(min_length=1)
    description: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        # Strips spaces from the script name
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value):
        # Strips spaces from the description
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, value):
        # Keeps the script content as text
        if isinstance(value, str):
            return value
        return value

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, value: str):
        # Rejects the script when the content is empty
        if not value.strip():
            raise ValueError("content is required")
        return value


class PatchScriptRequest(BaseModel):
    name: str = ""
    content: str | None = None
    description: str = ""
    status: Literal[0, 1] | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_optional_strings(cls, value):
        # Strips spaces from the name and the description
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, value):
        # Keeps the script content as text
        if value is None:
            return value
        if isinstance(value, str):
            return value
        return value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value):
        # Turns the status into 0 or 1
        if value is None:
            return value
        if isinstance(value, bool):
            raise ValueError("status must be 0 or 1")
        if isinstance(value, str):
            value = value.strip()
            if value not in ("0", "1"):
                raise ValueError("status must be 0 or 1")
            return int(value)
        if isinstance(value, int) and value in (0, 1):
            return value
        raise ValueError("status must be 0 or 1")

    @model_validator(mode="after")
    def require_content_or_status(self):
        # Requires content unless a status is being set
        if self.status is not None:
            return self
        if self.content is None or not self.content.strip():
            raise ValueError("content is required")
        return self


class DeleteScriptRequest(BaseModel):
    content: str = ""

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value):
        # Turns a missing content into an empty string
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        return value
