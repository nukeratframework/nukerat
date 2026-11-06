from pydantic import AliasChoices, BaseModel, Field, model_validator


class TerminalRequest(BaseModel):
    command: str = Field(min_length=1)
    source_terminal: str = Field(
        min_length=1,
        validation_alias=AliasChoices("source_terminal", "sourceTerminal"),
    )
    host_tag: str | None = Field(
        default=None,
        validation_alias=AliasChoices("host_tag", "host", "tag", "hostTag", "session"),
    )
    download_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("download_id", "downloadId"),
    )
    download_file: str | None = Field(
        default=None,
        validation_alias=AliasChoices("download_file", "downloadFile"),
    )
    tmp_file_bytes: str | None = Field(
        default=None,
        validation_alias="__tmp_file_bytes__",
        serialization_alias="__tmp_file_bytes__",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_command(cls, data):
        # Copies input into command when command is missing
        if isinstance(data, dict) and not data.get("command") and data.get("input"):
            data = {**data, "command": data["input"]}
        return data
