from pydantic import AliasChoices, BaseModel, Field, field_validator


class ListLogsQuery(BaseModel):
    search: str = ""
    logType: str = Field(
        default="all",
        validation_alias=AliasChoices("logType", "log_type"),
    )
    category: str = "all"
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(
        default=50,
        ge=1,
        le=500,
        validation_alias=AliasChoices("pageSize", "page_size"),
    )

    @field_validator("search", "logType", "category", mode="before")
    @classmethod
    def strip_strings(cls, value):
        # Strips spaces from the search and filter strings
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("logType", "category", mode="after")
    @classmethod
    def default_filter_values(cls, value: str):
        # Falls back to all when the filter is empty
        return value if value else "all"
