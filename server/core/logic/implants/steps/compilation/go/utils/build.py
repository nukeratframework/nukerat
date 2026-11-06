import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path

from infra.general.create_log import logger, write_log
from launcher.utils.config import config as server_config
from ...sandbox import create_syntax_for_sandbox_build
from .paths import project
from . import prep as ph


go_os = {
    "windows": "windows",
    "linux": "linux",
    "macos": "darwin",
}

go_arch = {
    ("amd", "x64"): "amd64",
    ("amd", "x86"): "386",
    ("arm", "x64"): "arm64",
}

linux_mac_arch = {
    ("amd", "x64"): "amd64",
    ("arm", "x64"): "arm64",
}

output_names = {
    "so": "main.so",
    "elf": "main",
    "app": "main",
    "dll": "main.dll",
}


def go_bin():
    # Finds the go compiler
    env_bin = os.environ.get("GO_BIN", "").strip()
    if env_bin and os.path.isfile(env_bin) and os.access(env_bin, os.X_OK):
        return env_bin

    name = "go.exe" if sys.platform == "win32" else "go"

    found = shutil.which(name)
    if found:
        return found

    candidate = Path("/usr/bin") / name
    if candidate.is_file() and os.access(candidate, os.X_OK):
        return str(candidate)

    return None


def go_root():
    # Finds the go root
    env_root = os.environ.get("GOROOT", "").strip()
    if env_root:
        return Path(env_root)

    go = go_bin()
    if go:
        try:
            out = subprocess.run(
                [go, "env", "GOROOT"],
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
            root = out.stdout.strip()
            if root and Path(root).is_dir():
                return Path(root)
        except (OSError, subprocess.SubprocessError):
            pass

    return None


def go_env(path):
    # Builds the go env for the compile
    root = go_root()
    if not root:
        raise FileNotFoundError(
            "go toolchain not found; install golang-go (apt) or set GOROOT"
        )

    go = go_bin()
    if not go:
        raise FileNotFoundError(
            "go compiler not found; install golang-go (apt) or set GO_BIN"
        )

    env = os.environ.copy()
    go_bin_dir = str(Path(go).resolve().parent)
    gocache = os.environ.get("GOCACHE", "").strip() or str(
        Path.home() / ".cache" / "go-build"
    )
    gomodcache = os.environ.get("GOMODCACHE", "").strip() or str(
        Path.home() / "go" / "pkg" / "mod"
    )
    Path(gocache).mkdir(parents=True, exist_ok=True)
    Path(gomodcache).mkdir(parents=True, exist_ok=True)
    env["GOROOT"] = str(root)
    env["GOCACHE"] = gocache
    env["GOMODCACHE"] = gomodcache
    env["PATH"] = f"{go_bin_dir}{os.pathsep}{env.get('PATH', '')}"
    env["CGO_ENABLED"] = "0"
    return go, env


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


def target_from_config(config):
    # Reads the go os and arch from the config
    cpu = config.get("cpu", "amd")
    arch = config.get("arch", "x64")
    os_name = str(config.get("operational_system", "windows")).strip().lower()
    target_os = go_os.get(os_name, "linux")

    if os_name in ("linux", "macos"):
        key = (cpu, arch)
        if key not in linux_mac_arch:
            raise ValueError(f"unsupported target: {os_name} cpu={cpu} arch={arch}")
        return target_os, linux_mac_arch[key]

    return target_os, go_arch.get((cpu, arch), "amd64")


async def go_args(config, path):
    # Builds the go compile command
    go, env = go_env(path)

    os_name = str(config.get("operational_system", "windows")).strip().lower()
    target_os, target_arch = target_from_config(config)
    fmt = config.get("format", "exe")
    out = os.path.join(path, output_names.get(fmt, "main.exe"))

    if os.path.isfile(os.path.join(path, "vendor", "modules.txt")):
        mod = "vendor"
    else:
        mod = "mod"

    env["GOFLAGS"] = f"-mod={mod}"
    args = [go, "build", f"-mod={mod}", "-trimpath", "-ldflags", "-s -w", "-o", out, "."]

    env["GOOS"] = target_os
    env["GOARCH"] = target_arch
    if sys.platform == "darwin" and os_name == "macos":
        env["GOOS"] = "darwin"
        env["GOARCH"] = target_arch

    return args, env


async def go_prepare(path, env):
    # Runs go mod tidy when the module graph is not resolved yet
    if os.path.isfile(os.path.join(path, "vendor", "modules.txt")):
        return None
    if os.path.isfile(os.path.join(path, "go.sum")):
        return None

    go = go_bin()
    if not go:
        return "go compiler not found; install golang-go (apt) or set GO_BIN"

    args = [go, "mod", "tidy"]
    exec_env = env
    if server_config.get("compiler", {}).get("sandbox"):
        gocache = Path(env["GOCACHE"])
        gomodcache = Path(env["GOMODCACHE"])
        gocache.mkdir(parents=True, exist_ok=True)
        gomodcache.mkdir(parents=True, exist_ok=True)
        args = create_syntax_for_sandbox_build(
            args,
            path,
            env=env,
            rw_binds=[str(gocache), str(gomodcache)],
        )
        exec_env = None

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=path,
        env=exec_env,
    )
    out, err = await proc.communicate()
    if proc.returncode:
        stdout = out.decode(errors="replace")
        stderr = err.decode(errors="replace")
        return format_build_output(stdout, stderr, "go mod tidy failed")
    return None


async def build(config, body, path=None):
    # Compiles the go implant
    path = ph.tmpdir or path or await project(body)

    try:
        args, env = await go_args(config, path)
    except (FileNotFoundError, ValueError) as exc:
        write_log(logger, "error", f"Unhandled exception | implants/go/build | {exc}")
        msg = str(exc)
        return {
            "status": "failure",
            "message": msg,
            "stdout": "",
            "stderr": msg,
        }

    tidy_err = await go_prepare(path, env)
    if tidy_err:
        return {
            "status": "failure",
            "message": tidy_err,
            "stdout": "",
            "stderr": tidy_err,
        }

    exec_env = env
    if server_config.get("compiler", {}).get("sandbox"):
        gocache = Path(env["GOCACHE"])
        gomodcache = Path(env["GOMODCACHE"])
        gocache.mkdir(parents=True, exist_ok=True)
        gomodcache.mkdir(parents=True, exist_ok=True)
        args = create_syntax_for_sandbox_build(
            args,
            path,
            env=env,
            rw_binds=[str(gocache), str(gomodcache)],
        )
        exec_env = None

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=path,
        env=exec_env,
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

    fmt = config.get("format", "exe")
    return {
        "path": os.path.join(path, output_names.get(fmt, "main.exe")),
        "stdout": stdout,
        "stderr": stderr,
    }
