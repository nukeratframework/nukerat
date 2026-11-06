import json

text_max = 500
param_key_max = 250
ellipsis = "..."


def clip(text, limit):
    # Cuts the text when it is too long
    s = "" if text is None else str(text)
    if len(s) <= limit:
        return s
    keep = max(0, limit - len(ellipsis))
    return s[:keep] + ellipsis


def sanitize_text(text):
    # Cuts the queue text when it is too long
    return clip(text, text_max)


def sanitize_parameters(raw):
    # Cuts the queue parameters when they are too long
    if raw is None or raw == "":
        return ""
    if not isinstance(raw, str):
        raw = json.dumps(raw)
    try:
        data = json.loads(raw)
    except Exception:
        return clip(raw, param_key_max)
    if not isinstance(data, dict):
        return clip(raw, param_key_max)
    out = {}
    for k, v in data.items():
        key = clip(k, param_key_max)
        if isinstance(v, str):
            out[key] = clip(v, param_key_max)
        elif isinstance(v, (dict, list)):
            out[key] = clip(json.dumps(v, ensure_ascii=False), param_key_max)
        else:
            out[key] = v
    return json.dumps(out, ensure_ascii=False)
