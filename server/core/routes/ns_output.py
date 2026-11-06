from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.ns_output.core import fetch_ns_output

router = APIRouter()


@router.get("/")
async def list_output(request: Request):
    # Entrypoint that lists the nukescript output
    try:
        return await fetch_ns_output(request)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
