from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, Field, StrictBool, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


AgentTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class AgentHeader(BaseModel):
    key: str = Field(min_length=1)
    value: str = Field(min_length=1)


class AgentConfig(BaseModel):
    name: str = Field(min_length=1)
    type: Literal["deepseek", "custom"] = "deepseek"
    apiKey: str = ""
    endpoint: str = ""
    headers: list[AgentHeader] = []
    bodyTemplate: str = ""
    responseField: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        # Strips spaces from the agent name
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("apiKey", "endpoint", "bodyTemplate", "responseField", mode="before")
    @classmethod
    def strip_optional_strings(cls, value):
        # Strips spaces from optional agent strings
        if isinstance(value, str):
            return value.strip()
        return value


class AgentContextMessage(BaseModel):
    role: str = Field(min_length=1)
    content: str = Field(min_length=1)

    @field_validator("role", "content", mode="before")
    @classmethod
    def strip_required_strings(cls, value):
        # Strips spaces from the role and the content
        if isinstance(value, str):
            return value.strip()
        return value


class CreateAgentRequest(BaseModel):
    type: Literal["create"]
    config: AgentConfig


class UsageAgentRequest(BaseModel):
    type: Literal["usage"]
    model: str = Field(min_length=1)
    id: str = Field(min_length=1)
    message: str = Field(min_length=1)
    context: list[AgentContextMessage] = []
    system_prompt: str = ""
    use_full_context: StrictBool = False

    @field_validator("model", "id", "message", mode="before")
    @classmethod
    def strip_required_strings(cls, value):
        # Strips spaces from the model, id and message
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("system_prompt", mode="before")
    @classmethod
    def strip_system_prompt(cls, value):
        # Strips spaces from the system prompt
        if isinstance(value, str):
            return value.strip()
        return value


class PatchAgentRequest(BaseModel):
    config: AgentConfig


AgentRequest = Annotated[
    CreateAgentRequest | UsageAgentRequest,
    Field(discriminator="type"),
]
