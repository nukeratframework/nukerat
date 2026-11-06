import re
from functools import lru_cache


@lru_cache(maxsize=64)
def template_to_regex(template: str) -> re.Pattern[bytes]:
    # Turns a content template into a regex pattern
    parts = template.split("§content§")
    pattern = b""
    for i, part in enumerate(parts):
        pattern += re.escape(part.encode("utf-8"))
        if i < len(parts) - 1:
            pattern += b"(.+?)"
    return re.compile(pattern, re.DOTALL)


def extract_from_template(raw: bytes, template: str) -> bytes | None:
    # Extracts the content bytes from the wrapped body
    template = (template or "").strip()
    if not template or template == "§content§":
        return raw
    match = template_to_regex(template).search(raw)
    if not match:
        return None
    return match.group(1)


def wrap_template(template: str | None, payload: bytes) -> bytes:
    # Wraps the payload bytes inside the response template
    template = (template or "").strip()
    if not template or template == "§content§":
        return payload
    parts = template.split("§content§")
    out = b""
    for i, part in enumerate(parts):
        out += part.encode("utf-8")
        if i < len(parts) - 1:
            out += payload
    return out


def implant_config_value(cfg: dict, key: str) -> str:
    # Returns a config string and reads the old beacon keys too
    if key == "implantBody":
        return str(cfg.get("implantBody") or cfg.get("beaconBody") or "").strip()
    if key == "implantBodyType":
        return str(cfg.get("implantBodyType") or cfg.get("beaconBodyType") or "").strip()
    return str(cfg.get(key) or "").strip()


def prepare_listener_config(cfg: dict) -> dict:
    # Copies the config and fills implant fields from the beacon names
    out = dict(cfg)
    if out.get("beaconBody") and not out.get("implantBody"):
        out["implantBody"] = out["beaconBody"]
    if out.get("beaconBodyType") and not out.get("implantBodyType"):
        out["implantBodyType"] = out["beaconBodyType"]
    value = str(out.get("implantBody") or "").strip()
    if value:
        out["implantBody"] = value
    return out
