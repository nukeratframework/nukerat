from pydantic import AliasChoices, BaseModel, Field, field_validator


class ProcessRequest(BaseModel):
    host: str = Field(
        min_length=1,
        validation_alias=AliasChoices("host", "host_tag", "tag", "hostTag", "session"),
    )

    @field_validator("host", mode="before")
    @classmethod
    def strip_host(cls, value):
        # Strips spaces from the host
        if isinstance(value, str):
            return value.strip()
        return value
