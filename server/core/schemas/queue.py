from typing import Annotated

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


QueueTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class ListQueueQuery(BaseModel):
    search: str = ""
    hostTag: str = Field(
        default="all",
        validation_alias=AliasChoices("hostTag", "host_tag", "host"),
    )
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(
        default=50,
        ge=1,
        le=500,
        validation_alias=AliasChoices("pageSize", "page_size"),
    )

    @field_validator("search", mode="before")
    @classmethod
    def strip_search(cls, value):
        # Strips spaces from the search text
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("hostTag", mode="before")
    @classmethod
    def strip_host_tag(cls, value):
        # Strips the host tag and falls back to all
        if value is None:
            return "all"
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else "all"
        return value
