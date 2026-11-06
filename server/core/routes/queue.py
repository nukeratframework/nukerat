from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.queue.core import delete_queue_route, fetch_queue
from schemas.queue import ListQueueQuery, QueueTag

router = APIRouter()


@router.get("/")
async def list_queue(request: Request, query: Annotated[ListQueueQuery, Query()]):
    # Entrypoint that lists the queue lines
    try:
        return await fetch_queue(query)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: QueueTag):
    # Entrypoint that deletes a queue line
    try:
        return await delete_queue_route(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
