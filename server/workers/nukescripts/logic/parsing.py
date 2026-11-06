import re

from infra.general.create_log import logger, write_log
from logic.functions import approve_cmd, async_cmd, cmd, agent, conclude, echo, folders, message_box, process, reject_cmd, screenshot
from logic.functions.credentials import credentials
from logic.functions.file_server import file_server
from logic.functions.network import network
from logic.functions.db import db
from logic.functions.keylogs import keylogs

bind_re = re.compile(r"^\s*event\.(\w+)\s*:\s*(\w+)\s*\(\s*\)\s*$")
func_re = re.compile(r"def\s+(\w+)\s*\(([^)]*)\)\s*:")
legacy_re = re.compile(r"\breprove_cmd\b")
trigger_re = re.compile(r"^(approved|rejected)$")


def normalize(content):
    # Replaces the old reprove_cmd name with reject_cmd
    return legacy_re.sub("reject_cmd", content or "")


def trigger_done(value):
    # Checks if the trigger is approved or rejected
    return bool(value and trigger_re.match(str(value)))


def has_event(content, event):
    # Checks if the script binds the given event
    needle = f"event.{event}:"
    for line in (content or "").splitlines():
        if line.strip().startswith(needle):
            return True
    return False


class ScriptRow(dict):
    def __getitem__(self, key):
        # Returns the key or None when it is missing
        return self.get(key)


def event_row(row):
    # Wraps a dict row so missing keys return None
    return ScriptRow(row) if isinstance(row, dict) else row


def prepare(content, event):
    # Keeps only the binding for this event and calls it with evt
    out = []
    for line in normalize(content).splitlines():
        m = bind_re.match(line)
        if not m:
            out.append(line)
        elif m.group(1) == event:
            out.append(f"{m.group(2)}(evt)")
    return "\n".join(out)


def build_namespace(row, script):
    # Builds the functions the script can call
    name = script.get("name", "?")
    line = row.get("input", "")
    return {
        "evt": row,
        "cmd": cmd.run,
        "agent": agent.run,
        "async_cmd": async_cmd.run,
        "screenshot": screenshot.run,
        "process": process.run,
        "folders": folders.run,
        "approve_cmd": approve_cmd.run,
        "reject_cmd": lambda tag: reject_cmd.run(tag, name, line),
        "conclude": conclude.run,
        "message_box": message_box.run,
        "echo": echo.run,
        "credentials": credentials,
        "file_server": file_server,
        "network": network,
        "db": db,
        "keylogs": keylogs,
    }


def inject_native_cmds(content, event, row, script):
    # Here is where the script is prepared and executed
    code = prepare(content, event)
    name = script.get("name", "?")
    namespace = build_namespace(row, script)
    from logic.sandbox import enabled, run

    if enabled():
        run(code, name, namespace)
    else:
        exec(compile(code, f"<script:{name}>", "exec"), namespace)


def check(content):
    # Checks the script syntax and the event bindings
    content = normalize(content)
    fns = {}
    for m in func_re.finditer(content):
        raw = m.group(2).strip()
        params = []
        if raw:
            for p in raw.split(","):
                p = p.strip()
                if p:
                    params.append(p)
        fns[m.group(1)] = params
    for line in content.splitlines():
        s = line.strip()
        if not s.startswith("event."):
            continue
        m = bind_re.match(line)
        if not m:
            return {"status": "failure", "message": f"invalid event binding: {s[:80]}"}
        fn = m.group(2)
        if fn not in fns:
            return {"status": "failure", "message": f"function not found: {fn}"}
        if len(fns[fn]) != 1:
            return {"status": "failure", "message": f"{fn} must have 1 parameter"}
    body = []
    for line in content.splitlines():
        if bind_re.match(line):
            continue
        body.append(line)
    try:
        compile("\n".join(body), "<script>", "exec")
        return {"status": "success", "message": "Syntax OK"}
    except SyntaxError as e:
        return {"status": "failure", "message": e.msg or str(e)}
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/parsing | {e}")
        return {"status": "failure", "message": str(e)}
