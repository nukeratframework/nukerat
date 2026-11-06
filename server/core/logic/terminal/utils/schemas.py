import shlex

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

cfg = ConfigDict(extra="ignore")


def missing(*flags: str) -> ValueError:
    # Builds the missing flag error
    return ValueError("missing required flag(s): " + ", ".join(flags) + ".")


def split_cli_args(args: str) -> list[str]:
    # Splits the command args into a list
    if not args or not str(args).strip():
        return []
    return shlex.split(str(args), posix=False)


def int_or_none(v, flag: str):
    # Turns the value into an int or none
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        return int(str(v).strip())
    except ValueError:
        raise ValueError(f"{flag} must be an integer.")


# --- General -----------------------------------------------------------------

class Config(BaseModel):
    model_config = cfg


class Delay(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that delay seconds are an integer
        if not self.args.strip():
            raise ValueError("delay requires seconds. Example: delay 4")
        try:
            int(self.args.split()[0])
        except ValueError:
            raise ValueError("delay seconds must be an integer.")
        return self


class Kill(BaseModel):
    model_config = cfg


class Tasks(BaseModel):
    model_config = cfg


class TasksKill(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that tasks kill has a task id
        if not self.args.strip():
            raise ValueError("tasks kill requires a task ID. Example: tasks kill 3912")
        return self


# --- Filesystem --------------------------------------------------------------

class Pwd(BaseModel):
    model_config = cfg


class Cd(BaseModel):
    model_config = cfg


class Ls(BaseModel):
    model_config = cfg


class Cat(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that cat has a file path
        if not self.args.strip():
            raise ValueError("cat requires a file path.")
        return self


class Preview(BaseModel):
    model_config = cfg
    args: str = ""
    size_limit: int | None = None

    @field_validator("size_limit", mode="before")
    @classmethod
    def size(cls, v):
        # Turns the size limit into an int or none
        return int_or_none(v, "--size-limit")

    @model_validator(mode="after")
    def check(self):
        # Checks the preview path and the size limit
        if not self.args.strip():
            raise ValueError("preview requires a file path.")
        if self.size_limit is not None and self.size_limit < 1:
            raise ValueError("--size-limit must be at least 1.")
        return self


class Fileinfo(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that fileinfo has a path
        if not self.args.strip():
            raise ValueError("fileinfo requires a path.")
        return self


class Acl(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that acl has a path
        if not self.args.strip():
            raise ValueError("acl requires a path.")
        return self


class Echo(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that echo has text
        if not self.args.strip():
            raise ValueError("echo requires text or $<variable>.")
        return self


class Cp(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that cp has a source and a destination
        parts = split_cli_args(self.args)
        if len(parts) < 2:
            raise ValueError("cp requires <source> and <destination>.")
        return self


class Mv(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that mv has a source and a destination
        parts = split_cli_args(self.args)
        if len(parts) < 2:
            raise ValueError("mv requires <source> and <destination>.")
        return self


class Rm(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that rm has a path
        if not self.args.strip():
            raise ValueError("rm requires a path.")
        return self


class Ren(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that ren has a source and a destination
        parts = split_cli_args(self.args)
        if len(parts) < 2:
            raise ValueError("ren requires <source> and <destination>.")
        return self


class Mkdir(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that mkdir has a path
        if not self.args.strip():
            raise ValueError("mkdir requires a path.")
        return self


class Rmdir(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that rmdir has a path
        if not self.args.strip():
            raise ValueError("rmdir requires a path.")
        return self


class Upload(BaseModel):
    model_config = cfg
    file: str = ""
    output: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that upload has a file and an output
        if not self.file.strip():
            raise missing("-f")
        if not self.output.strip():
            raise missing("-o")
        return self


class Download(BaseModel):
    model_config = cfg
    file: str = ""
    output: str = ""
    size: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks the download file and the size
        if not self.file.strip():
            raise missing("-f")
        if self.size.strip():
            try:
                int(self.size.strip())
            except ValueError:
                raise ValueError("--size must be an integer (megabytes).")
        return self


class RegCreate(BaseModel):
    model_config = cfg
    path: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that reg create has a path
        if not self.path.strip():
            raise missing("--path")
        return self


class RegEdit(BaseModel):
    model_config = cfg
    path: str = ""
    data: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that reg edit has a path and data
        needed = []
        if not self.path.strip():
            needed.append("--path")
        if not self.data.strip():
            needed.append("--data")
        if needed:
            raise missing(*needed)
        return self


class RegDelete(BaseModel):
    model_config = cfg
    path: str = ""
    delete_key: bool = False
    name: str = ""
    value: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks the reg delete path and the target
        if not self.path.strip():
            raise missing("--path")
        if not self.delete_key and not self.name.strip() and not self.value.strip():
            raise ValueError(
                "specify --name (or --value) to delete a value, or --delete-key to remove the key."
            )
        return self


class RegRead(BaseModel):
    model_config = cfg
    path: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that reg read has a path
        if not self.path.strip():
            raise missing("--path")
        return self


class RegSearch(BaseModel):
    model_config = cfg
    query: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that reg search has a query
        if not self.query.strip():
            raise missing("--query")
        return self


class Search(BaseModel):
    model_config = cfg
    path: str = ""
    content: str = ""
    thread: int | None = None
    size_limit: int | None = None

    @field_validator("thread", "size_limit", mode="before")
    @classmethod
    def int_fields(cls, v, info):
        # Turns thread and size limit into ints or none
        flag = "--thread" if info.field_name == "thread" else "--size-limit"
        return int_or_none(v, flag)

    @model_validator(mode="after")
    def check(self):
        # Checks the search path, content, thread and size limit
        needed = []
        if not self.path.strip():
            needed.append("--path")
        if not self.content.strip():
            needed.append("--content")
        if needed:
            raise missing(*needed)
        if self.thread is not None and not (1 <= self.thread <= 32):
            raise ValueError("--thread must be between 1 and 32.")
        if self.size_limit is not None and self.size_limit < 1:
            raise ValueError("--size-limit must be at least 1.")
        return self


# --- Recognition -------------------------------------------------------------

class Whoami(BaseModel):
    model_config = cfg


class Systeminfo(BaseModel):
    model_config = cfg


class Env(BaseModel):
    model_config = cfg


class Tasklist(BaseModel):
    model_config = cfg


class Enumdrives(BaseModel):
    model_config = cfg


class Ifconfig(BaseModel):
    model_config = cfg


class Route(BaseModel):
    model_config = cfg


class Arp(BaseModel):
    model_config = cfg


class Portscan(BaseModel):
    model_config = cfg
    target: str = ""
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that portscan has a target
        if self.target.strip():
            return self
        parts = split_cli_args(self.args)
        if not parts:
            raise missing("--target", "-t")
        return self


class Netstat(BaseModel):
    model_config = cfg


class Hooks(BaseModel):
    model_config = cfg


# --- Execution ---------------------------------------------------------------

class Shell(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that shell has a command line
        if not self.args.strip():
            raise ValueError("shell requires a command line.")
        return self


class Powershell(BaseModel):
    model_config = cfg
    args: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that powershell has a script or command
        if not self.args.strip():
            raise ValueError("powershell requires a script or command.")
        return self


class Shellcode(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that shellcode has a file
        if not self.file.strip():
            raise missing("-f")
        return self


class Bof(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that bof has a file
        if not self.file.strip():
            raise missing("-f")
        return self


class Dotnet(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that dotnet has a file
        if not self.file.strip():
            raise missing("-f")
        return self


class LoadDll(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that load dll has a file
        if not self.file.strip():
            raise missing("-f")
        return self


class LoadSo(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that load so has a file
        if not self.file.strip():
            raise missing("-f")
        return self


class LoadDylib(BaseModel):
    model_config = cfg
    file: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that load dylib has a file
        if not self.file.strip():
            raise missing("-f")
        return self


# --- Injection ---------------------------------------------------------------

class Migrate(BaseModel):
    model_config = cfg
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that migrate has a pid
        if self.pid is None:
            raise ValueError("migrate requires a pid. Example: migrate 4919")
        return self


class Spawn(BaseModel):
    model_config = cfg
    target: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that spawn has a target
        if not self.target.strip():
            raise missing("-t")
        return self


class SpawnSuspend(BaseModel):
    model_config = cfg
    target: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that spawn suspend has a target
        if not self.target.strip():
            raise missing("-t")
        return self


class InjSpawn(BaseModel):
    model_config = cfg
    target: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that inj spawn has a target
        if not self.target.strip():
            raise missing("-t")
        return self


class InjShellcode(BaseModel):
    model_config = cfg
    file: str = ""
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks the inj shellcode file and the pid
        needed = []
        if not self.file.strip():
            needed.append("-f")
        if self.pid is None:
            needed.append("-p")
        if needed:
            raise missing(*needed)
        return self


class InjDllReflective(BaseModel):
    model_config = cfg
    file: str = ""
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks the reflective dll file and the pid
        needed = []
        if not self.file.strip():
            needed.append("-f")
        if self.pid is None:
            needed.append("-p")
        if needed:
            raise missing(*needed)
        return self


class InjDonut(BaseModel):
    model_config = cfg
    file: str = ""
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks the donut file and the pid
        needed = []
        if not self.file.strip():
            needed.append("-f")
        if self.pid is None:
            needed.append("-p")
        if needed:
            raise missing(*needed)
        return self


# --- Process -----------------------------------------------------------------

class ProcInfo(BaseModel):
    model_config = cfg


class ProcPrivileges(BaseModel):
    model_config = cfg
    pid: int | None = None
    name: str = ""
    status: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks the proc privileges name and status
        if self.pid is not None:
            raise ValueError("proc privileges does not accept --pid (current process token only)")
        if not self.name.strip():
            raise ValueError(
                "proc privileges requires --name. Example: proc privileges --name SeDebugPrivilege -st on"
            )
        st = self.status.strip().lower()
        if st not in ("on", "off", "enable", "disable", "enabled", "disabled", "1", "0", "true", "false"):
            raise ValueError("proc privileges requires -st on or -st off")
        return self


class ProcKill(BaseModel):
    model_config = cfg
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that proc kill has a pid
        if self.pid is None:
            raise ValueError("proc kill requires --pid. Example: proc kill --pid 1234")
        return self


class ProcSuspend(BaseModel):
    model_config = cfg
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that proc suspend has a pid
        if self.pid is None:
            raise ValueError("proc suspend requires --pid. Example: proc suspend --pid 1234")
        return self


class ProcResume(BaseModel):
    model_config = cfg
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that proc resume has a pid
        if self.pid is None:
            raise ValueError("proc resume requires --pid. Example: proc resume --pid 1234")
        return self


class Tokens(BaseModel):
    model_config = cfg


class TokensGrab(BaseModel):
    model_config = cfg
    pid: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that tokens grab has a pid
        if self.pid is None:
            raise ValueError("tokens grab requires --pid. Example: tokens grab --pid 1000")
        return self


class TokensList(BaseModel):
    model_config = cfg


class TokensImpersonate(BaseModel):
    model_config = cfg
    id: int | None = None

    @model_validator(mode="after")
    def check(self):
        # Checks that tokens impersonate has an id
        if self.id is None:
            raise ValueError("tokens impersonate requires --id. Example: tokens impersonate --id 0")
        return self


class TokensRemove(BaseModel):
    model_config = cfg
    id: str = ""
    all: bool = False

    @model_validator(mode="after")
    def check(self):
        # Checks that tokens remove has an id or all
        if not self.all and not self.id.strip():
            raise ValueError("tokens remove requires --id or --all")
        return self


class TokensForge(BaseModel):
    model_config = cfg
    user: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that tokens forge has a user
        if not self.user.strip():
            raise ValueError("tokens forge requires --user (and usually --pass, --domain)")
        return self


class TokensRevert(BaseModel):
    model_config = cfg


class Runas(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    user: str = ""
    password: str = Field(default="", validation_alias="pass")
    path: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks the runas user, password and path
        if not self.user.strip():
            raise ValueError("runas requires --user")
        if not self.password.strip():
            raise ValueError("runas requires --pass")
        if not self.path.strip():
            raise ValueError(
                "runas requires --path (executable). Example: runas --domain CORP -u jhon -p 123 "
                "--path C:\\Windows\\System32\\cmd.exe --- /c whoami"
            )
        return self


# --- Pivoting ----------------------------------------------------------------

class Relay(BaseModel):
    model_config = cfg


class RelayCreate(BaseModel):
    model_config = cfg
    channel: str = ""
    listen: str = ""
    target: str = ""
    tls: bool = False

    @model_validator(mode="after")
    def check(self):
        # Checks the relay channel, listen and target
        needed = []
        if not self.channel.strip():
            needed.append("-c")
        if not self.listen.strip():
            needed.append("-l")
        if not self.target.strip():
            needed.append("-t")
        if needed:
            raise missing(*needed)
        return self


class RelayDelete(BaseModel):
    model_config = cfg
    id: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks that relay delete has an id
        if not self.id.strip():
            raise missing("--id")
        return self


# --- Utilities ---------------------------------------------------------------

class Getsystem(BaseModel):
    model_config = cfg
    method: str = ""
    sacrifice: str = ""
    path: str = ""

    @model_validator(mode="after")
    def check(self):
        # Checks the getsystem method and the sacrifice host
        method = (self.method or "inject").strip().lower()
        if method in ("token", "com"):
            host = self.sacrifice.strip() or self.path.strip()
            if not host:
                raise ValueError("getsystem --method token/com requires --sacrifice (or --path).")
        elif method not in ("", "inject"):
            raise ValueError("getsystem --method must be inject, token, or com.")
        return self


class KeyloggerStart(BaseModel):
    model_config = cfg
    method: str = ""
    delay: int = 0

    @field_validator("delay", mode="before")
    @classmethod
    def delay_field(cls, v):
        # Turns the keylogger delay into an int
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return 0
        try:
            n = int(str(v).strip())
        except ValueError:
            raise ValueError("--delay must be an integer (milliseconds).")
        if n < 0:
            raise ValueError("--delay must be zero or a positive integer (milliseconds).")
        return n

    @model_validator(mode="after")
    def check(self):
        # Checks the keylogger method
        mode = self.method.strip()
        if mode and mode not in ("keystate", "boardstate"):
            raise ValueError("invalid --method. Use keystate or boardstate.")
        return self


class KeyloggerStop(BaseModel):
    model_config = cfg


class Screenshot(BaseModel):
    model_config = cfg


class ScreenshotStart(BaseModel):
    model_config = cfg
    delay: str = ""

    @field_validator("delay", mode="before")
    @classmethod
    def delay_field(cls, v):
        # Strips the screenshot delay
        if v is None or (isinstance(v, str) and not v.strip()):
            return ""
        return str(v).strip()

    @model_validator(mode="after")
    def check(self):
        # Checks that the screenshot delay is an integer
        if self.delay and not self.delay.isdigit():
            raise ValueError("--delay must be an integer (seconds).")
        return self


class ScreenshotStop(BaseModel):
    model_config = cfg


# Comandos do help/default.txt (sem armory, lolbins, help, prefix, modificadores)

schemas = {
    "config": Config,
    "delay": Delay,
    "kill": Kill,
    "tasks": Tasks,
    "tasks kill": TasksKill,
    "pwd": Pwd,
    "cd": Cd,
    "ls": Ls,
    "cat": Cat,
    "preview": Preview,
    "fileinfo": Fileinfo,
    "acl": Acl,
    "echo": Echo,
    "cp": Cp,
    "mv": Mv,
    "rm": Rm,
    "ren": Ren,
    "mkdir": Mkdir,
    "rmdir": Rmdir,
    "upload": Upload,
    "download": Download,
    "reg create": RegCreate,
    "reg edit": RegEdit,
    "reg delete": RegDelete,
    "reg read": RegRead,
    "reg search": RegSearch,
    "search": Search,
    "whoami": Whoami,
    "systeminfo": Systeminfo,
    "env": Env,
    "tasklist": Tasklist,
    "enumdrives": Enumdrives,
    "ifconfig": Ifconfig,
    "route": Route,
    "arp": Arp,
    "portscan": Portscan,
    "netstat": Netstat,
    "hooks": Hooks,
    "shell": Shell,
    "powershell": Powershell,
    "shellcode": Shellcode,
    "bof": Bof,
    "dotnet": Dotnet,
    "load-dll": LoadDll,
    "load-so": LoadSo,
    "load-dylib": LoadDylib,
    "migrate": Migrate,
    "spawn": Spawn,
    "spawn suspend": SpawnSuspend,
    "inj spawn": InjSpawn,
    "inj shellcode": InjShellcode,
    "inj dll-reflective": InjDllReflective,
    "inj donut": InjDonut,
    "proc info": ProcInfo,
    "proc privileges": ProcPrivileges,
    "proc kill": ProcKill,
    "proc suspend": ProcSuspend,
    "proc resume": ProcResume,
    "tokens": Tokens,
    "tokens grab": TokensGrab,
    "tokens list": TokensList,
    "tokens impersonate": TokensImpersonate,
    "tokens remove": TokensRemove,
    "tokens forge": TokensForge,
    "tokens revert": TokensRevert,
    "runas": Runas,
    "relay": Relay,
    "relay create": RelayCreate,
    "relay delete": RelayDelete,
    "getsystem": Getsystem,
    "keylogger start": KeyloggerStart,
    "keylogger stop": KeyloggerStop,
    "screenshot": Screenshot,
    "screenshot start": ScreenshotStart,
    "screenshot stop": ScreenshotStop,
}


def validate_command_params(command: str, params: dict) -> str | None:
    # Validates the command params and returns the error
    schema = schemas.get(command)
    if not schema:
        return None
    try:
        schema.model_validate(params)
    except ValidationError as exc:
        msg = exc.errors()[0].get("msg", "invalid arguments.")
        if msg.startswith("Value error, "):
            msg = msg[13:]
        return f"Error: {msg}"
    return None
