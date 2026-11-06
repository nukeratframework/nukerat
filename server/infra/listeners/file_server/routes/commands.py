import os
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, Response
from infra.listeners.profile import apply_profile_middleware
from infra.listeners.file_server.utils.create_log import create_log
from infra.listeners.file_server.utils.sanitization import resolve_path

content_root = os.path.join(os.path.dirname(__file__), "content")

def make_app(content_dir: str, config: Optional[dict] = None) -> FastAPI:
    # Builds the file server app and registers the routes
    root = os.path.realpath(content_dir)
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.middleware("http")(apply_profile_middleware(config or {}))

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        # Middleware to log each request
        response = await call_next(request)
        client = request.client.host if request.client else "-"
        create_log(
            f'"{request.method} {request.url.path} {request.scope["http_version"]}" {response.status_code}',
            client=client,
        )
        return response

    @app.api_route("/{path:path}", methods=["GET", "HEAD"])
    async def serve(path: str = ""):
        # Receives the path and returns the file
        if "\x00" in path:
            return Response(status_code=404)
        target = resolve_path(root, path)
        if not target:
            return Response(status_code=403)
        if os.path.isdir(target):
            return Response(status_code=200, content=b"", media_type="text/html")
        if not os.path.isfile(target):
            return Response(status_code=404)
        return FileResponse(target)

    return app
