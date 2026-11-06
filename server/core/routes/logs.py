from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from core.logic.logs.core import fetch_logs
from infra.general.create_log import logger, write_log
from schemas.logs import ListLogsQuery

router = APIRouter()


@router.get("/")
async def list_logs(request: Request, query: Annotated[ListLogsQuery, Query()]):
    # Entrypoint that lists the logs
    try:
        return await fetch_logs(query)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
