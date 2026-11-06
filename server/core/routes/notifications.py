from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.notifications.core import fetch_notifications
from core.logic.notifications.custom.core import fetch_custom_notifications

router = APIRouter()


@router.get("/")
async def list_notifications(request: Request):
    # Entrypoint that lists the notifications
    try:
        return await fetch_notifications(request)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.get("/custom")
async def list_custom_notifications(request: Request):
    # Entrypoint that lists the custom notifications
    try:
        return await fetch_custom_notifications(request)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
