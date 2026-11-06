from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from core.logic.listeners.core import delete_listener, fetch_listeners, main_listeners
from infra.general.create_log import logger, write_log
from schemas.listeners import ListenerRequest

router = APIRouter()


@router.get("/")
async def list_listeners(request: Request):
    # Entrypoint that lists the listeners
    try:
        return await fetch_listeners()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/")
async def root(request: Request, body: ListenerRequest):
    # Entrypoint that creates or updates a listener
    try:
        return await main_listeners(body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: str):
    # Entrypoint that deletes a listener
    try:
        return await delete_listener(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
