from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from core.logic.screenshot.core import fetch_screenshot
from infra.general.create_log import logger, write_log
from schemas.screenshot import ScreenshotQuery, ScreenshotTag

router = APIRouter()


@router.get("/{tag}")
async def get(request: Request, tag: ScreenshotTag, query: Annotated[ScreenshotQuery, Query()]):
    # Entrypoint that returns the screenshot of the host
    try:
        return await fetch_screenshot(tag, query.model_dump(), request)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
