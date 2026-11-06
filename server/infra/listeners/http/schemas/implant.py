from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError, model_validator

ImplantOption = Literal["input", "new", "output", "kill_task"]
OutputType = Literal[
    "terminal",
    "folders",
    "process",
    "keylogger",
    "screenshot",
    "socks",
    "proxychains",
    "port_forwarding",
]


class ImplantMetadata(BaseModel):
    relays: list[str] | None = None
    privilege: str | None = None
    internal_ip: str | None = None
    host: str | None = None
    port: str | int | None = None


class ImplantInputRequest(BaseModel):
    option: Literal["input"]
    host: str = Field(min_length=1)
    metadata: ImplantMetadata | None = None


class ImplantNewRequest(BaseModel):
    option: Literal["new"]
    tag: str = Field(min_length=1)
    ip: str = ""
    external_ip: str = ""
    listener: str = Field(min_length=1)
    pid: int
    arch: str = Field(min_length=1)
    os: str = Field(min_length=1)
    user: str = Field(min_length=1)
    hostname: str = Field(min_length=1)
    delay: int = Field(ge=0)
    implant_config: dict[str, Any] | str
    notes: str | None = None
    process: str | int | None = None
    info: dict[str, Any] | list[Any] | str | None = None
    metadata: ImplantMetadata | None = None


class ImplantOutputRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    option: Literal["output"] = "output"
    type: OutputType
    task_tag: str = Field(min_length=1)
    host: str = ""
    output: str | None = None
    error: str | None = None

    @model_validator(mode="before")
    @classmethod
    def default_output_option(cls, data):
        # Fills option with output when the payload omits it
        if isinstance(data, dict) and "type" in data and "task_tag" in data and "option" not in data:
            return {**data, "option": "output"}
        return data


class ImplantKillTaskRequest(BaseModel):
    option: Literal["kill_task"]
    task_tag: str = Field(min_length=1)


class ImplantTaskErrorRequest(BaseModel):
    error: str = Field(min_length=1)
    task_tag: str = Field(min_length=1)


_OutputListAdapter = TypeAdapter(list[ImplantOutputRequest])


def parse_implant_payload(data: dict | list) -> dict | list:
    # Validates the implant payload and returns a plain dict or list
    if isinstance(data, list):
        return [item.model_dump() for item in _OutputListAdapter.validate_python(data)]

    if not isinstance(data, dict):
        raise ValidationError.from_exception_data(
            "ImplantPayload",
            [{"type": "dict_type", "loc": (), "input": data, "msg": "Input should be a valid object"}],
        )

    if data.get("error") and data.get("task_tag") and not data.get("option"):
        return ImplantTaskErrorRequest.model_validate(data).model_dump()

    option = data.get("option")
    if option == "input":
        return ImplantInputRequest.model_validate(data).model_dump()
    if option == "new":
        return ImplantNewRequest.model_validate(data).model_dump()
    if option == "output":
        return ImplantOutputRequest.model_validate(data).model_dump()
    if option == "kill_task":
        return ImplantKillTaskRequest.model_validate(data).model_dump()

    raise ValidationError.from_exception_data(
        "ImplantPayload",
        [{"type": "literal_error", "loc": ("option",), "input": option, "msg": "Input should be 'input', 'new', 'output', or 'kill_task'"}],
    )
