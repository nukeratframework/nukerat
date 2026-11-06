import json
import os
import shutil
import socket
import subprocess
import sys
import threading
from datetime import date, datetime
from pathlib import Path

child_script = Path(__file__).with_name("sandbox_child.py").resolve()
child_inside = "/tmp/nukescript.py"


def enabled():
    # Checks if the nukescript sandbox is turned on
    from launcher.utils.config import config

    return bool(config.get("nukescripts", {}).get("sandbox"))


def run(code, name, namespace):
    # Runs the script inside the bubblewrap sandbox
    bwrap = shutil.which("bwrap") or shutil.which("bubblewrap")
    if not bwrap:
        raise RuntimeError("bubblewrap not found")
    if not child_script.is_file():
        raise RuntimeError("nukescript sandbox runner missing")

    parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
    child_fd = child.fileno()
    os.set_inheritable(child_fd, True)
    proc = subprocess.Popen(
        command(bwrap, child_fd),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        pass_fds=(child_fd,),
        close_fds=True,
    )
    child.close()
    err = bytearray()
    err_thread = threading.Thread(target=drain, args=(proc.stderr, err), daemon=True)
    err_thread.start()
    threading.Thread(target=drain, args=(proc.stdout, None), daemon=True).start()
    rpc = parent.makefile("rwb", buffering=0)
    try:
        send(rpc, {
            "op": "exec",
            "name": name,
            "code": code,
            "evt": namespace.get("evt"),
            "names": [key for key in namespace if key != "evt"],
        })
        while True:
            msg = recv(rpc)
            if msg is None:
                proc.wait()
                err_thread.join(timeout=1)
                detail = err.decode("utf-8", "replace").strip()
                raise RuntimeError(detail or "nukescript sandbox exited")
            if msg.get("op") == "done":
                return
            if msg.get("op") == "error":
                raise RuntimeError(msg.get("error") or "nukescript sandbox failed")
            reply(rpc, namespace, msg)
    finally:
        rpc.close()
        parent.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()


def reply(rpc, namespace, msg):
    # Calls the native function and sends the result back
    try:
        result = call(namespace, msg.get("name", ""), msg.get("args") or [], msg.get("kwargs") or {})
        send(rpc, {"id": msg.get("id"), "ok": True, "result": result})
    except Exception as exc:
        send(rpc, {
            "id": msg.get("id"),
            "ok": False,
            "error": str(exc),
            "type": type(exc).__name__,
        })


def call(namespace, name, args, kwargs):
    # Resolves the name in the namespace and calls it
    parts = str(name).split(".")
    if not parts or any(not part or part.startswith("_") for part in parts):
        raise AttributeError(name)
    if parts[0] not in namespace:
        raise AttributeError(name)
    obj = namespace[parts[0]]
    for part in parts[1:]:
        obj = getattr(obj, part)
    if not callable(obj):
        raise TypeError(f"{name} is not callable")
    return obj(*args, **kwargs)


def send(rpc, payload):
    # Sends one JSON line through the rpc socket
    rpc.write(json.dumps(payload, default=json_default).encode() + b"\n")


def recv(rpc):
    # Reads one JSON line from the rpc socket
    line = rpc.readline()
    if not line:
        return None
    return json.loads(line)


def json_default(value):
    # Turns dates and bytes into text for JSON
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    raise TypeError(f"cannot return {type(value).__name__} to script")


def drain(pipe, buf):
    # Reads the pipe until it closes and keeps the last chunk
    try:
        while True:
            chunk = pipe.read(4096)
            if not chunk:
                break
            if buf is not None:
                buf.extend(chunk)
                if len(buf) > 8192:
                    del buf[:-8192]
    except Exception:
        pass


def command(bwrap, rpc_fd):
    # Builds the bubblewrap command for the sandbox child
    lang = os.environ.get("LANG", "C.UTF-8") or "C.UTF-8"
    argv = [
        bwrap,
        "--unshare-all",
        "--share-net",
        "--die-with-parent",
        "--new-session",
        "--clearenv",
        "--setenv", "PATH", "/usr/bin:/bin",
        "--setenv", "HOME", "/tmp",
        "--setenv", "TMPDIR", "/tmp",
        "--setenv", "LANG", lang,
        "--setenv", "LC_ALL", lang,
        "--setenv", "PYTHONNOUSERSITE", "1",
        "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
        "--setenv", "PYTHONSAFEPATH", "1",
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        "--chdir", "/tmp",
    ]
    from launcher.utils.config import config, sandbox_scope

    mounted = set()
    ro = (
        "/usr",
        "/lib",
        "/lib64",
        "/bin",
        "/sbin",
        str(Path(sys.prefix).resolve()),
        "/etc/resolv.conf",
        "/etc/hosts",
        "/etc/nsswitch.conf",
        "/etc/ssl",
        "/etc/ca-certificates",
    )
    rw = (config.get("sandbox") or {}).get("allowed_paths") or []
    for flag, paths in (("--ro-bind", ro), ("--bind", rw)):
        for path in paths:
            if not path or path in mounted or not os.path.lexists(path):
                continue
            mounted.add(path)
            argv.extend([flag, path, path])
    argv.extend(["--ro-bind", str(child_script), child_inside])
    argv.extend(["--", sys.executable, child_inside, str(rpc_fd)])
    return sandbox_scope(argv)
