import asyncio
import shlex
from datetime import datetime, timezone
from infra.database.database import Host, sqlite_db
from infra.general.create_log import logger, write_log
from utils.querys import create_queue_line
from .ascii_art import arts
from ..mapping import commands, compatibility_list, double_commands
from .bof import bof_sanitization
from .fixes import apply_fixes
from .lolbins import create_lolbins_help
from .schemas import validate_command_params
from .parse_args import parse_args, parse_special_args, remove_blob_payload_tmp, return_blob_payload
from .tmp import extract_tmp_file
from .txt_read import read_message


def parse_command(body):
    # Splits the input into the verb and the command id
    input = body.get("command", "")
    head, _ = remove_blob_payload_tmp(input)
    background = head.startswith("&")
    if background:
        head = head.replace("&", "", 1).strip()
        if "--__tmp_file_bytes__" in input:
            blob_idx = input.find("--__tmp_file_bytes__")
            input = f"{head} {input[blob_idx:].lstrip()}"
        else:
            input = head
        body["command"] = input

    parts = head.split()
    verb = parts[0] if parts else ""
    for e in sorted(double_commands, key=len, reverse=True):
        word_count = len(e.split())
        if len(parts) >= word_count and " ".join(parts[:word_count]) == e:
            verb = e
            break

    cmd = commands["complete_list"].get(verb)
    if not cmd and verb.startswith("ns-"):
        cmd = commands["complete_list"].get("ns-")

    return input, background, verb, cmd.get("id") if cmd else None


async def help_text(input, verb):
    # Builds the help text of the command
    if verb == "lolbins":
        return create_lolbins_help(input)

    if verb == "rat":
        return await rat_ascii_art()

    if verb == "help":
        parts = shlex.split(input, posix=False)
        if len(parts) >= 2:
            if parts[1] == "lolbins":
                if len(parts) == 2:
                    return read_message("commands/lolbins.txt") or ""
                return create_lolbins_help("lolbins " + " ".join(parts[2:]))
            if parts[1] == "lolbin":
                return create_lolbins_help(input)
        if len(parts) == 2 and not parts[1].startswith("-"):
            arg = parts[1]
            lolbin_help = arg
            if lolbin_help.startswith("lol-") and lolbin_help != "lolbin":
                lolbin_help = lolbin_help[4:]
            return (
                read_message("tools/" + arg + ".txt")
                or read_message("commands/" + arg + ".txt")
                or read_message("lolbins/" + lolbin_help + ".txt")
                or read_message("lolbins/" + arg + ".txt")
                or "No help available for this command."
            )
        flags = commands["flags"]
        i = 1
        while i < len(parts):
            flag = flags.get(parts[i])
            if flag:
                key, takes_value = flag
                if key == "os" and takes_value and i + 1 < len(parts):
                    os_name = parts[i + 1].lower()
                    if os_name == "linux":
                        return read_message("help/linux.txt") or ""
                    if os_name in ("mac"):
                        return read_message("help/mac.txt") or ""
                    if os_name == "windows":
                        return read_message("help/default.txt") or ""
                    else:
                        return "Error: invalid OS argument"
                if takes_value:
                    i = i + 2
                else:
                    i = i + 1
            else:
                i = i + 1
        return read_message("help/default.txt") or ""

    return read_message("armory.txt") or ""


async def compat_error(host_tag, verb, cmd_id):
    # Checks if the command is supported on the host system
    if not host_tag or not cmd_id:
        return None
    rows = await sqlite_db.read(Host, tag=host_tag)
    host_os = (rows[0].os if rows else "").lower()
    if "mac" in host_os and verb not in compatibility_list.get("mac", []):
        return "Feature not supported on macOS"
    if "linux" in host_os and verb not in compatibility_list.get("linux", []):
        return "Feature not supported on Linux"
    if "windows" in host_os and verb not in compatibility_list.get("windows", []):
        return "Feature not supported on Windows"
    return None


async def build_command(input, cmd_id, source_terminal, tmp_file_bytes=None):
    # Here is where the command is parsed, fixed and validated
    try:
        # Remove blob payloads before parsing, like exe bytes or dll bytes
        input, blob = remove_blob_payload_tmp(input)
        # ================================================================
        input, bg, wait = await parse_special_args(input)
        params = {"source_terminal": source_terminal, "bg": bg, "wait": wait}
        command, params = await parse_args(input, params, cmd_id)
        # Add blob payloads back to params
        return_blob_payload(params, blob)
        if tmp_file_bytes and not params.get("__tmp_file_bytes__"):
            params["__tmp_file_bytes__"] = tmp_file_bytes
        # ================================================================
    except (FileNotFoundError, ValueError) as e:
        write_log(logger, "error", f"Unhandled exception | terminal/command | {e}")
        return None, None, str(e)
    if params == "tool_not_found":
        return None, None, 'Tool not installed. Use "armory install <tool>"'
    await asyncio.to_thread(extract_tmp_file, input, params)
    apply_fixes(command, params)
    err = validate_command_params(command, params)
    if err:
        return None, None, err
    err = bof_sanitization(command, params)
    if err:
        return None, None, err
    return command, params, None


async def enqueue(host_tag, command, params, endpoint_command):
    # Stores a new terminal line in the queue
    kwargs = {"host": host_tag, "qtype": "terminal", "input": command, "parameters": params, "command": endpoint_command}
    if command.startswith("ns-"):
        kwargs["is_ready"] = 0
    return await create_queue_line(**kwargs)

async def rat_ascii_art():
    # Picks one ascii art from the hour clock
    keys = tuple(arts)
    if not keys:
        return ""
    now = datetime.now(timezone.utc)
    ms_into_hour = ((now.minute * 60 + now.second) * 1000) + (now.microsecond // 1000)
    return arts[keys[ms_into_hour % len(keys)]]