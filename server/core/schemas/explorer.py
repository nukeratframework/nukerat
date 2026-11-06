from typing import Self

from pydantic import AliasChoices, BaseModel, Field, StrictBool, field_validator, model_validator


class ExplorerRequest(BaseModel):
    host: str = Field(
        min_length=1,
        validation_alias=AliasChoices("host", "host_tag", "tag", "hostTag"),
    )
    path: str = "/"
    getContent: StrictBool = Field(
        default=False,
        validation_alias=AliasChoices("getContent", "get_content"),
    )
    fileName: str | None = Field(
        default=None,
        validation_alias=AliasChoices("fileName", "file_name"),
    )
    autoRefresh: StrictBool = Field(
        default=False,
        validation_alias=AliasChoices("autoRefresh", "auto_refresh"),
    )

    @field_validator("host", mode="before")
    @classmethod
    def strip_host(cls, value):
        # Strips spaces from the host
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("path", mode="before")
    @classmethod
    def strip_path(cls, value):
        # Strips spaces from the path and falls back to root
        if value is None:
            return "/"
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else "/"
        return value

    @field_validator("fileName", mode="before")
    @classmethod
    def strip_file_name(cls, value):
        # Strips spaces from the file name
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def validate_file_download(self) -> Self:
        # Requires a file name and a path when downloading content
        if not self.getContent:
            return self

        if not (self.fileName or "").strip():
            raise ValueError("fileName is required when getContent is true")

        path = (self.path or "").strip()
        if not path or path == "/":
            raise ValueError("path is required when getContent is true")

        return self
