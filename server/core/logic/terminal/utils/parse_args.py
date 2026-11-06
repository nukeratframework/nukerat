import re
import shlex

from ..mapping import commands
from .paths import armory_dir


def remove_blob_payload_tmp(command):
    # Cuts the blob payload out of the command
    for flag in ("--__tmp_file_bytes__",):
        idx = command.find(flag)
        if idx != -1:
            payload = command[idx + len(flag) :].strip() or None
            return command[:idx].rstrip(), payload
    return command, None


def return_blob_payload(params, payload):
    # Puts the blob payload back into the params
    if payload:
        params["__tmp_file_bytes__"] = payload


def parse_custom_simple_cmd(command_key, command, params, flags, pid_from_first=False):
    # Parses flags of a simple command into params
    if command.startswith(command_key):
        tail = command[len(command_key) :].lstrip()
        parts = shlex.split(tail, posix=False) if tail.strip() else []
        i = 0
    else:
        parts = shlex.split(command, posix=False)
        i = 1
    remainder = []
    while i < len(parts):
        flag = flags.get(parts[i])
        if flag:
            key, takes_value = flag
            if takes_value and i + 1 < len(parts):
                params[key] = parts[i + 1]
                i += 2
            elif not takes_value:
                params[key] = True
                i += 1
            else:
                i += 1
        else:
            remainder.append(parts[i])
            i += 1
    if remainder:
        params["args"] = " ".join(remainder)
        if pid_from_first:
            params["pid"] = remainder[0]
    return command_key


async def parse_special_args(command):
    # Pulls background and wait flags out of the command
    bg = None
    wait = None
    flags = commands["flags"]
    parts = shlex.split(command, posix=False) if command.strip() else []
    if not parts:
        return command, bg, wait

    kept = [parts[0]]
    i = 1
    while i < len(parts):
        flag = flags.get(parts[i])
        if flag and parts[i] in ("-bg", "-w", "--wait"):
            _, takes_value = flag
            if takes_value and i + 1 < len(parts):
                wait = parts[i + 1]
                try:
                    int(wait)
                except ValueError:
                    raise ValueError("Error: invalid wait time, must be an integer")
                i += 2
            elif not takes_value:
                bg = True
                i += 1
            else:
                i += 1
        else:
            kept.append(parts[i])
            i += 1
    return " ".join(kept), bg, wait


async def parse_args(command, params, cmd_id):
    # Parses the command into params by its parsing mode
    command_key = None
    if cmd_id is not None:
        for key, value in commands["complete_list"].items():
            if value["id"] == cmd_id:
                command_key = key
                break
    if command_key is None:
        command_key = command.split()[0] if command.split() else command

    entry = commands["complete_list"].get(command_key, {})
    mode = entry.get("parsing_mode", "")
    flags = commands["flags"]

    if mode == "simple_cmd" or mode == "implant_ctrl":
        if command.startswith(command_key):
            params["args"] = command[len(command_key):].lstrip()
            # params["args"] = command[len(command_key):].lstrip().strip('"')
        else:
            params["args"] = " ".join(command.split(" ")[1:])
            # params["args"] = " ".join(command.split(" ")[1:]).strip('"')
        params["mode"] = entry.get("mode", command_key)
        command = command_key

    elif mode == "flagged_exec":
        command = parse_custom_simple_cmd(command_key, command, params, flags)
        params["mode"] = command_key

    elif mode == "custom_simple_cmd":
        command = parse_custom_simple_cmd(command_key, command, params, flags, pid_from_first=True)
        params["mode"] = entry.get("mode", command_key)

    elif mode == "ns_cmd":
        m = re.match(r"^(ns-\S+)(?:\s+(.*))?$", command)
        command = m.group(1) if m else command_key
        params["args"] = (m.group(2) or "") if m else ""
        # params["args"] = (m.group(2) or "").strip('"') if m else ""
        params["mode"] = entry.get("mode", command)

    elif mode == "file_exec":
        if "---" in command:
            left, right = command.split("---", 1)
            raw_args = right.strip()
        else:
            left = command
            raw_args = ""
        left = left.strip()
        left_for_flags = left[len(command_key):].lstrip() if left.startswith(command_key) else left
        parts = shlex.split(left_for_flags, posix=False)
        i = 0
        while i < len(parts):
            flag = flags.get(parts[i])
            if flag:
                key, takes_value = flag
                if takes_value and i + 1 < len(parts):
                    params[key] = parts[i + 1]
                    i += 2
                elif not takes_value:
                    params[key] = True
                    i += 1
                else:
                    i += 1
            else:
                i += 1
        if raw_args:
            params["args"] = raw_args
        params["mode"] = entry.get("mode", command_key)
        command = command_key

    if handler := entry.get("content_handler"):
        params["content_handler"] = handler

    if entry.get("is_armory"):
        file_path = armory_dir / entry["armory_bin"]
        if not file_path.is_file():
            return False, "tool_not_found"
        params["is_armory"] = True
        params["file"] = str(file_path)

    params["raw"] = entry.get("raw", command_key)
    return command, params
