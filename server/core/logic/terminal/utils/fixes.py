from typing import Any


def normalize_path_flag(value):
    # Strips spaces and quotes from a path flag
    if value is None:
        return ""
    s = str(value).strip()
    if s.startswith('"'):
        s = s[1:]
    if s.endswith('"'):
        s = s[:-1]
    return s


def apply_fixes(command, params):
    # Fixes path flags and a few command defaults
    for key, val in list[Any](params.items()):
        if isinstance(val, str) and key in {
            "file", "path", "output", "inject", "sacrifice", "bin", "bins_path",
            "stomp_dll", "_tmp_file_path", "alloc",
        }:
            params[key] = normalize_path_flag(val)
    if command == "lolbin" and params.get("path"):
        params["bin"] = params["path"]
    elif command == "keylogger start" and params.get("method", "") == "":
        params["method"] = "boardstate"
