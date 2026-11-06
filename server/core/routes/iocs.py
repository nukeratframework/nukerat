from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.iocs.core import fetch_iocs, remove_ioc
from schemas.iocs import IocTag, ListIocsQuery

router = APIRouter()


@router.get("/")
async def list_iocs(request: Request, query: Annotated[ListIocsQuery, Query()]):
    # Entrypoint that lists the iocs
    try:
        return await fetch_iocs(query)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: IocTag):
    # Entrypoint that deletes an ioc
    try:
        return await remove_ioc(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
