from typing import Annotated

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


ScreenshotTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class ScreenshotQuery(BaseModel):
    hash: str | None = None
    long_polling: bool = Field(
        default=False,
        validation_alias=AliasChoices("long_polling", "longPolling"),
    )

    @field_validator("hash", mode="before")
    @classmethod
    def strip_hash(cls, value):
        # Strips the hash and returns none when it is empty
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else None
        return value
