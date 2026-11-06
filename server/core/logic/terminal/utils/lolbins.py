import json
import shlex
from functools import lru_cache
from pathlib import Path

from logic.terminal.mapping import commands, double_commands, return_help

from .txt_read import read_message


@lru_cache(maxsize=1)
def _lolbins_catalog():
    # Loads the lolbins catalog
    path = Path(__file__).resolve().parents[3] / "utils" / "lolbins.json"
    return json.loads(path.read_text(encoding="utf-8"))

def create_lolbins_help(input):
    # Builds the lolbins help text
    parts = shlex.split(input, posix=False)
    header = "\n"
    cat = None
    if len(parts) >= 2 and parts[0] == "lolbins" and parts[1] != "check":
        if parts[1] == "--category" and len(parts) >= 3:
            cat = parts[2].lower()
        elif not parts[1].startswith("-"):
            cat = parts[1].lower()
    if cat and cat.startswith("lol-") and cat != "lolbin":
        cat = cat[4:]
    if cat:
        body = read_message("lolbins/_" + cat + ".txt")
        if body:
            return header + body
        return header
    text = header
    text = text + "\n\n" + (read_message("lolbins/_execute.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_download.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_dll.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_proxy.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_dump.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_compile.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_compress.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_copy.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_credentials.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_upload.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_inject.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_evasion.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_recon.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_tamper.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_uac.txt") or "")
    text = text + "\n\n" + (read_message("lolbins/_ads.txt") or "")
    text = text + (
        "\n\n\n[!] Important: lolbins does not send compiled binaries, only invokes host binaries."
    )
    return text


def should_expand_lolbin_command(line):
    # Checks if the line is a lolbin shortcut
    line = line.lstrip("&").strip()
    parts = line[:50].split()
    if not parts:
        return False
    if parts[0] == "lolbin":
        return True
    if not parts[0].startswith("lol-"):
        return False
    for entry in sorted(double_commands, key=len, reverse=True):
        if line == entry or line.startswith(f"{entry} "):
            return False
    if parts[0] in return_help:
        return False
    mapped = commands["complete_list"].get(parts[0])
    if not mapped or mapped.get("mode") != "lolbins":
        return False
    return parts[0][4:] in _lolbins_catalog()


def expand_lolbin_command(line):
    # Turns a lolbin shortcut into the full command
    line = line.strip()
    if not line:
        return None
    try:
        parts = shlex.split(line, posix=False)
    except ValueError:
        return None
    if not parts:
        return None
    if parts[0] == "lolbin":
        return None
    if not parts[0].startswith("lol-"):
        return None
    name = parts[0][4:]
    catalog = _lolbins_catalog()
    if name not in catalog:
        return None

    override = None
    rest = []
    i = 1
    while i < len(parts):
        if parts[i] == "--path" and i + 1 < len(parts):
            override = parts[i + 1]
            i += 2
            continue
        rest.append(parts[i])
        i += 1

    catalog_path = catalog[name].get("path") or ""
    path = override if override else catalog_path
    if not path or path == "{}":
        return None

    safe = path.replace('"', "")
    bin_flag = f'lolbin --bin "{safe}"'
    if not rest:
        return bin_flag
    return f"{bin_flag} {' '.join(rest)}"

def create_lolbins_check_command(line):
    # Builds the lolbins check command and the bin paths
    line = line.strip()
    if not line:
        return None
    try:
        parts = shlex.split(line, posix=False)
    except ValueError:
        return None
    if len(parts) < 2 or parts[0] != "lolbins" or parts[1] != "check":
        return None

    tag = None
    if len(parts) >= 3:
        if parts[2] == "--type" and len(parts) >= 4:
            tag = parts[3]
        elif not parts[2].startswith("-"):
            tag = parts[2]

    needle = (tag or "").strip().lower()
    if not needle:
        return None

    bins = {}
    for name, entry in _lolbins_catalog().items():
        tags = entry.get("tags") or []
        if needle not in [t.lower() for t in tags]:
            continue
        path = (entry.get("path") or "").strip()
        if path and path != "{}":
            bins[name] = path
    if not bins:
        return None

    return {
        "command": f"lolbins check {shlex.quote(needle)}",
        "bins_path": bins,
    }