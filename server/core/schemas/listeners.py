from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ResponseHeader(BaseModel):
    key: str = Field(min_length=1)
    value: str = Field(min_length=1)


class CertConfig(BaseModel):
    enabled: bool = False
    source: Literal["manual", "self_signed"] | None = None
    certPem: str | None = None
    keyPem: str | None = None


class RestartListenerRequest(BaseModel):
    type: Literal["restart"]
    tag: str = Field(min_length=1)


class CreateChannelListenerRequest(BaseModel):
    type: Literal["create"]
    listenerType: Literal["channel"]
    name: str = Field(min_length=1)
    host: str = Field(min_length=1)
    portToOpen: int = Field(ge=1, le=65535)
    channelPayload: Literal["http", "https"] = "http"
    port: int | None = Field(default=None, ge=1, le=65535)
    endpointPath: str | None = None
    longPollingMode: bool = False
    implantBodyType: Literal["off", "custom", "json", "xml"] | None = None
    implantBody: str | None = None
    listenerResponse: str | None = None
    responseHeaders: list[ResponseHeader] | None = None
    cert: CertConfig | None = None


class CreateFileServerListenerRequest(BaseModel):
    type: Literal["create"]
    listenerType: Literal["file_server"]
    name: str = Field(min_length=1)
    host: str = Field(min_length=1)
    portToOpen: int = Field(ge=1, le=65535)
    ssl: bool = False
    port: int | None = Field(default=None, ge=1, le=65535)
    responseHeaders: list[ResponseHeader] | None = None
    cert: CertConfig | None = None


CreateListenerRequest = Annotated[
    CreateChannelListenerRequest | CreateFileServerListenerRequest,
    Field(discriminator="listenerType"),
]

ListenerRequest = Annotated[
    RestartListenerRequest | CreateListenerRequest,
    Field(discriminator="type"),
]
