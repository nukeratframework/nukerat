def listener_path(config: dict) -> str:
    # Normalizes the listener endpoint path from the config
    path = str(config.get("endpointPath") or "/").strip()
    if not path.startswith("/"):
        path = f"/{path}"
    return path.rstrip("/") or "/"


def apply_profile_middleware(config: dict):
    # Builds the middleware that applies the listener response profile
    headers = config.get("responseHeaders") or []
    strip = {"server", "x-powered-by"}

    async def middleware(request, call_next):
        # Middleware to strip server headers and apply custom response headers
        response = await call_next(request)
        for key in list(response.headers.keys()):
            if key.lower() in strip:
                del response.headers[key]
        for h in headers:
            key = str(h.get("key") or "").strip()
            if key:
                response.headers[key] = str(h.get("value") or "")
        return response

    return middleware
