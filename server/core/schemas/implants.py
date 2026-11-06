from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

from schemas.listeners import ResponseHeader

Os = Literal["windows", "linux", "macos"]
Cpu = Literal["amd", "arm"]
Arch = Literal["x64", "x86"]
Format = Literal["exe", "dll", "shellcode", "elf", "so", "app"]
SleepMask = Literal["off", "timer", "zilean"]
PatchToggle = Literal["on", "off"]
StringObfuscation = Literal["off", "xor", "rc4"]
ApiResolution = Literal["dynamic"]
WinApiMethod = Literal["indirect"]
ImplantBodyType = Literal["off", "custom", "json", "xml"]
DonutEntropy = Literal["none", "random", "encrypt"]
DonutCompress = Literal["none", "aplib"]
DonutHeaders = Literal["overwrite", "keep"]
DonutExit = Literal["thread", "process", "block"]
ShellcodeEncoder = Literal["off", "sgn", "supernova"]
StagelessProtocol = Literal["http", "https", "smb", "tcp", "custom"]
LoaderProtocol = Literal["http", "custom"]

_OS_FORMATS: dict[str, set[str]] = {
    "windows": {"exe", "dll", "shellcode"},
    "linux": {"elf", "so"},
    "macos": {"app"},
}

_PE_FORMATS = {"exe", "dll", "shellcode"}
_NIM_FORMATS = {"exe", "dll", "shellcode", "elf", "so", "app"}
_HTTP_PROTOCOLS = {"http", "https"}


class FileAttachment(BaseModel):
    name: str = Field(min_length=1)
    bytes: str = Field(min_length=1)


class PeTimestampRange(BaseModel):
    lo: int
    hi: int


class BodyContent(BaseModel):
    type: ImplantBodyType
    request_body: str | None = None
    response_body: str | None = None
    cookies: list[ResponseHeader] | None = None
    headers: list[ResponseHeader] | None = None

    @model_validator(mode="after")
    def validate_body_fields(self) -> Self:
        # Requires request and response bodies when the body type is on
        if self.type != "off":
            if not (self.request_body or "").strip():
                raise ValueError("request_body is required when body type is not off")
            if not (self.response_body or "").strip():
                raise ValueError("response_body is required when body type is not off")
        return self


class ImplantConfigBase(BaseModel):
    operational_system: Os
    cpu: Cpu
    arch: Arch
    format: Format
    servers: dict[str, str] = Field(default_factory=dict)
    sleep: str = "2"
    delay: str = "20"
    second_delay: str = ""
    syscall_method: WinApiMethod = "indirect"
    sleep_mask: SleepMask = "off"
    string_obfuscation: StringObfuscation = "xor"
    etw_patch: PatchToggle = "off"
    amsi_patch: PatchToggle = "off"
    pe_headers_patch: PatchToggle = "off"
    show_conhost: PatchToggle = "off"
    api_resolution: ApiResolution = "dynamic"
    exe_icon: FileAttachment | None = None
    body_content: BodyContent | None = None
    smb_pipe: str | None = None
    custom_channel: str | None = None
    custom_http_relay: str | None = None
    preface: str | None = None
    create_pe_strings: str | None = None
    pe_timestamp: PeTimestampRange | None = None
    pe_major_linker_version: int | None = Field(default=None, ge=0, le=65535)
    pe_minor_linker_version: int | None = Field(default=None, ge=0, le=65535)
    pe_major_os_version: int | None = Field(default=None, ge=0, le=65535)
    pe_minor_os_version: int | None = Field(default=None, ge=0, le=65535)
    pe_major_image_version: int | None = Field(default=None, ge=0, le=65535)
    pe_minor_image_version: int | None = Field(default=None, ge=0, le=65535)
    pe_major_subsystem_version: int | None = Field(default=None, ge=0, le=65535)
    pe_minor_subsystem_version: int | None = Field(default=None, ge=0, le=65535)
    donut_entropy: DonutEntropy | None = None
    donut_compress: DonutCompress | None = None
    donut_headers: DonutHeaders | None = None
    donut_exit: DonutExit | None = None
    donut_thread: bool | None = None
    shellcode_encoder: ShellcodeEncoder | None = None

    @staticmethod
    def _filled_servers(servers: dict[str, str]) -> list[str]:
        # Returns the server values that are not empty
        return [value.strip() for value in servers.values() if str(value).strip()]

    def _validate_os_format_cpu(self) -> None:
        # Checks that the format, cpu and arch match the system
        allowed_formats = _OS_FORMATS[self.operational_system]
        if self.format not in allowed_formats:
            raise ValueError(
                f"format '{self.format}' is not supported for {self.operational_system}"
            )
        if self.operational_system == "windows" and self.cpu != "amd":
            raise ValueError("cpu must be amd for windows")
        if self.operational_system == "windows" and self.arch != "x64":
            raise ValueError("arch must be x64 for windows")

    def _validate_optional_fields(self) -> None:
        # Checks icon, pe, donut, encoder and preface options
        if self.exe_icon is not None and self.format != "exe":
            raise ValueError("exe_icon is only supported for exe format")

        pe_fields = (
            self.pe_timestamp,
            self.pe_major_linker_version,
            self.pe_minor_linker_version,
            self.pe_major_os_version,
            self.pe_minor_os_version,
            self.pe_major_image_version,
            self.pe_minor_image_version,
            self.pe_major_subsystem_version,
            self.pe_minor_subsystem_version,
            self.create_pe_strings,
        )
        if any(pe_fields) and self.format not in _PE_FORMATS:
            raise ValueError("pe header fields are only supported for exe, dll, and shellcode")

        donut_fields = (
            self.donut_entropy,
            self.donut_compress,
            self.donut_headers,
            self.donut_exit,
            self.donut_thread,
        )
        if any(value is not None for value in donut_fields) and self.format != "shellcode":
            raise ValueError("donut fields are only supported for shellcode format")

        enc = self.shellcode_encoder
        if enc is not None and enc != "off":
            if self.operational_system != "windows":
                raise ValueError("shellcode_encoder is only supported on windows")

        if self.preface is not None and self.format not in _NIM_FORMATS:
            raise ValueError("preface is not supported for this format")

        if self.show_conhost == "on":
            if self.operational_system != "windows":
                raise ValueError("show_conhost is only supported on windows")
            if self.format != "exe":
                raise ValueError("show_conhost is only supported for exe format")


class StagelessImplantConfig(ImplantConfigBase):
    protocol: StagelessProtocol

    @model_validator(mode="after")
    def validate_stageless(self) -> Self:
        # Checks the stageless protocol, servers and extra fields
        self._validate_os_format_cpu()
        self._validate_optional_fields()

        if self.protocol == "smb":
            if self.operational_system != "windows":
                raise ValueError("smb protocol is only supported on windows")
            if not (self.smb_pipe or "").strip():
                raise ValueError("smb_pipe is required when protocol is smb")
        elif self.protocol == "custom":
            if not (self.custom_channel or "").strip():
                raise ValueError("custom_channel is required when protocol is custom")
        elif not self._filled_servers(self.servers):
            raise ValueError("servers must include at least one endpoint")

        if self.protocol not in _HTTP_PROTOCOLS and self.body_content is not None:
            raise ValueError("body_content is only supported for http and https protocols")

        if self.protocol != "smb" and self.smb_pipe is not None:
            raise ValueError("smb_pipe is only supported when protocol is smb")
        if self.protocol != "custom" and self.custom_channel is not None:
            raise ValueError("custom_channel is only supported when protocol is custom")
        if self.custom_http_relay is not None and self.protocol != "custom":
            raise ValueError("custom_http_relay is only supported when protocol is custom")

        return self


class LoaderImplantConfig(ImplantConfigBase):
    protocol: LoaderProtocol

    @model_validator(mode="after")
    def validate_loader(self) -> Self:
        # Checks the loader protocol, servers and extra fields
        self._validate_os_format_cpu()
        self._validate_optional_fields()

        if self.protocol == "custom":
            if not (self.custom_channel or "").strip():
                raise ValueError("custom_channel is required when protocol is custom")
        elif not self._filled_servers(self.servers):
            raise ValueError("servers must include at least one stage url")

        if self.body_content is not None:
            raise ValueError("body_content is not supported for loader implants")
        if self.smb_pipe is not None:
            raise ValueError("smb_pipe is not supported for loader implants")
        if self.protocol != "custom" and self.custom_channel is not None:
            raise ValueError("custom_channel is only supported when protocol is custom")
        if self.custom_http_relay is not None:
            raise ValueError("custom_http_relay is not supported for loader implants")

        return self


class BuildStagelessRequest(BaseModel):
    type: Literal["build"]
    implant_base: Literal["stageless"]
    config: StagelessImplantConfig


class BuildLoaderRequest(BaseModel):
    type: Literal["build"]
    implant_base: Literal["loader"]
    config: LoaderImplantConfig


ImplantRequest = Annotated[
    BuildStagelessRequest | BuildLoaderRequest,
    Field(discriminator="implant_base"),
]
