from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from core.logic.network.core import delete_connection, fetch_connections, main_network
from infra.general.create_log import logger, write_log
from schemas.network import NetworkConnectionTag, NetworkRequest

router = APIRouter()


@router.get("/")
async def list_connections(request: Request):
    # Entrypoint that lists the network sessions
    try:
        return await fetch_connections()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


@router.post("/")
async def root(request: Request, body: NetworkRequest):
    # Entrypoint that creates or restarts a network session
    try:
        return await main_network(body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


@router.delete("/{tag}")
async def delete(request: Request, tag: NetworkConnectionTag):
    # Entrypoint that deletes a network session
    try:
        return await delete_connection(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
