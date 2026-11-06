import re
from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, StrictBool, field_validator


def _strip_report_tag(value):
    # Strips the report tag and rejects an invalid one
    if isinstance(value, str):
        value = value.strip()
    if not value or not re.fullmatch(r"[\w.-]+", value):
        raise ValueError("tag is required")
    return value


ReportTag = Annotated[str, BeforeValidator(_strip_report_tag), Field(min_length=1)]


class CreateReportRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    reportType: Literal["activity", "hosts", "ioc"] = Field(
        validation_alias=AliasChoices("reportType", "report_type"),
    )
    fileType: Literal["pdf", "html", "json"] = Field(
        default="pdf",
        validation_alias=AliasChoices("fileType", "file_type"),
    )
    hostTags: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("hostTags", "host_tags"),
    )
    hideCredentials: StrictBool = Field(
        default=False,
        validation_alias=AliasChoices("hideCredentials", "hide_credentials"),
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        # Strips spaces from the report name
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

    @field_validator("reportType", mode="before")
    @classmethod
    def normalize_report_type(cls, value):
        # Strips the report type and lowercases it
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("fileType", mode="before")
    @classmethod
    def normalize_file_type(cls, value):
        # Strips the file type and lowercases it
        if isinstance(value, str):
            return value.strip().lower()
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
