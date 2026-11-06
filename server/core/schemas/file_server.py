import os
from typing import Annotated

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


def _safe_file_name(value):
    # Sanitizes the file name and rejects path pieces
    if not isinstance(value, str):
        raise ValueError("file name is required")
    name = os.path.basename(value.replace("\\", "/")).strip()
    if not name or name in (".", ".."):
        raise ValueError("file name is required")
    return name


FileServerTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]
FileServerFileName = Annotated[str, BeforeValidator(_safe_file_name), Field(min_length=1)]


class FileServerRenameRequest(BaseModel):
    new_file_name: str = Field(
        min_length=1,
        validation_alias=AliasChoices("new_file_name", "newFileName"),
    )

    @field_validator("new_file_name", mode="before")
    @classmethod
    def validate_new_file_name(cls, value):
        # Sanitizes the new file name
        return _safe_file_name(value)
