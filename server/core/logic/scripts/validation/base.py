import ast
import asyncio
import re

from infra.general.create_log import logger, write_log
from logic.scripts.validation.helpers import err
from logic.scripts.validation.commands import approve_cmd, async_cmd, cmd, agent, conclude, credentials, db, echo, file_server, folders, keylogs, message_box, network, process, reject_cmd, screenshot

bind_re = re.compile(r"^\s*event\.(\w+)\s*:\s*(\w+)\s*\(\s*\)\s*$")
legacy_re = re.compile(r"\breprove_cmd\b")
events = [
    "new_host", "removed_host", "expired_host", "new_queue_line", "implant_error", "task_completed", "new_checkin", "keylogger_update",
    "folders_update", "process_update", "output_received", "credentials_update", "listeners_update",
    "heartbeat_1s", "heartbeat_5s", "heartbeat_10s", "heartbeat_15s", "heartbeat_30s",
    "heartbeat_1m", "heartbeat_5m", "heartbeat_10m", "heartbeat_15m", "heartbeat_20m", "heartbeat_30m", "heartbeat_60m",
    "heartbeat_2h", "heartbeat_12h", "heartbeat_1d", "heartbeat_3d", "heartbeat_7d", "heartbeat_15d", "heartbeat_30d",
]

commands = {
    "cmd": cmd.validate,
    "agent": agent.validate,
    "async_cmd": async_cmd.validate,
    "process": process.validate,
    "folders": folders.validate,
    "screenshot": screenshot.validate,
    "message_box": message_box.validate,
    "echo": echo.validate,
    "conclude": conclude.validate,
    "approve_cmd": approve_cmd.validate,
    "reject_cmd": reject_cmd.validate,
    "credentials": credentials.validate,
    "file_server": file_server.validate,
    "network": network.validate,
    "db": db.validate,
    "keylogs": keylogs.validate,
}


def normalize(content):
    # Replaces the legacy reprove name with reject cmd
    return legacy_re.sub("reject_cmd", content or "")


def validate_commands(tree, line_map):
    # Checks each command call in the script
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name):
            fn = commands.get(node.func.id)
            if fn:
                result = fn(node, line_map)
                if result:
                    return result
        elif isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            if node.func.value.id == "credentials":
                result = credentials.validate_attr(node, line_map)
                if result:
                    return result
            if node.func.value.id == "file_server":
                result = file_server.validate_attr(node, line_map)
                if result:
                    return result
            if node.func.value.id == "network":
                result = network.validate_attr(node, line_map)
                if result:
                    return result
            if node.func.value.id == "db":
                result = db.validate_attr(node, line_map)
                if result:
                    return result
    return None


def validate_syntax(content):
    # Checks the script syntax, events and commands
    content = normalize(content)
    if not content.strip():
        return err(1, "empty script")

    lines = content.splitlines()
    body = []
    line_map = {}
    for i, line in enumerate(lines, 1):
        if bind_re.match(line):
            continue
        line_map[len(body) + 1] = i
        body.append(line)

    try:
        tree = ast.parse("\n".join(body), "<script>")
    except SyntaxError as e:
        msg = e.msg or str(e)
        if len(msg) > 64:
            msg = msg[:61] + "..."
        line = line_map.get(e.lineno, e.lineno or 1) if e.lineno else 1
        return err(line, msg)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | scripts/validation | {e}")
        raw = str(e)
        msg = raw.split(": ", 2)[-1] if ": " in raw else raw
        if len(msg) > 64:
            msg = msg[:61] + "..."
        return err(1, msg)

    fns = {}
    fn_lines = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            fns[node.name] = len(node.args.args)
            fn_lines[node.name] = line_map.get(node.lineno, node.lineno)

    event_count = 0
    for i, line in enumerate(lines, 1):
        if not line.strip().startswith("event."):
            continue
        m = bind_re.match(line)
        if not m:
            return err(i, "invalid event binding")
        name = m.group(1)
        if name not in events:
            return err(i, f'unknown event "{name}"')
        event_count += 1
        fn = m.group(2)
        if fn not in fns:
            return err(i, f"function '{fn}' not found")
        if fns[fn] != 1:
            return err(fn_lines[fn], "handler must have 1 parameter")

    if event_count == 0:
        return err(1, "at least one event required")

    seen_bind = False
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if not s:
            continue
        if bind_re.match(line):
            seen_bind = True
        elif seen_bind:
            return err(i, "event bindings must be at the end")

    command_error = validate_commands(tree, line_map)
    if command_error:
        return command_error

    return {"status": "success", "message": "Syntax OK"}


async def validate_syntax_async(content):
    # Runs the script syntax check in a thread
    return await asyncio.to_thread(validate_syntax, content)
