from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from core.logic.keylogger.core import delete_keylogger_route, fetch_keylogger
from infra.general.create_log import logger, write_log
from schemas.keylogger import KeyloggerEntryTag, KeyloggerQuery

router = APIRouter()


@router.get("/")
async def list_keylogger(request: Request, query: Annotated[KeyloggerQuery, Query()]):
    # Entrypoint that lists keylogger entries
    try:
        return await fetch_keylogger(query)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: KeyloggerEntryTag):
    # Entrypoint that deletes a keylogger entry
    try:
        return await delete_keylogger_route(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
