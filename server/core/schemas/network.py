from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, field_validator


def _strip_required_tag(value):
    # Strips the tag and rejects it when it is empty
    if isinstance(value, str):
        value = value.strip()
    if not value:
        raise ValueError("tag is required")
    return value


NetworkConnectionTag = Annotated[str, BeforeValidator(_strip_required_tag), Field(min_length=1)]


class RestartNetworkRequest(BaseModel):
    type: Literal["restart"]
    id: str = Field(min_length=1)

    @field_validator("id", mode="before")
    @classmethod
    def strip_id(cls, value):
        # Strips spaces from the session id
        if isinstance(value, str):
            return value.strip()
        return value


class CreateSocksNetworkRequest(BaseModel):
    type: Literal["create"]
    networkType: Literal["socks"]
    portToOpen: int = Field(ge=1, le=65535)
    hostTag: str = Field(
        min_length=1,
        validation_alias=AliasChoices("hostTag", "host_tag", "host", "tag"),
    )
    authUser: str = ""
    authPass: str = ""

    @field_validator("hostTag", mode="before")
    @classmethod
    def strip_host_tag(cls, value):
        # Strips spaces from the host tag
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("authUser", "authPass", mode="before")
    @classmethod
    def strip_auth(cls, value):
        # Strips spaces from the socks user and password
        if isinstance(value, str):
            return value.strip()
        return value


class CreatePortForwardNetworkRequest(BaseModel):
    type: Literal["create"]
    networkType: Literal["port_forwarding"]
    portToOpen: int = Field(ge=1, le=65535)
    hostTag: str = Field(
        min_length=1,
        validation_alias=AliasChoices("hostTag", "host_tag", "host", "tag"),
    )
    forwardHost: str = Field(min_length=1)
    forwardPort: int = Field(ge=1, le=65535)
    protocol: Literal["tcp"] = "tcp"

    @field_validator("hostTag", "forwardHost", mode="before")
    @classmethod
    def strip_required_strings(cls, value):
        # Strips spaces from the host tag and the forward host
        if isinstance(value, str):
            return value.strip()
        return value


CreateNetworkRequest = Annotated[
    CreateSocksNetworkRequest | CreatePortForwardNetworkRequest,
    Field(discriminator="networkType"),
]

NetworkRequest = Annotated[
    RestartNetworkRequest | CreateNetworkRequest,
    Field(discriminator="type"),
]
