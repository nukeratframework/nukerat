from typing import Annotated

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


IocTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class ListIocsQuery(BaseModel):
    search: str = ""
    hostTags: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("hostTags", "host_tags"),
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

    @field_validator("hostTags", mode="before")
    @classmethod
    def strip_host_tags(cls, value):
        # Strips host tags and drops empty duplicates
        if not isinstance(value, list):
            return value
        tags = []
        for item in value:
            if not isinstance(item, str):
                raise ValueError("each host tag must be a string")
            text = item.strip()
            if text and text not in tags:
                tags.append(text)
        return tags
