from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from infra.general.create_log import logger, write_log
from logic.explorer.core import main_explorer
from schemas.explorer import ExplorerRequest

router = APIRouter()


@router.post("/")
async def root(request: Request, body: ExplorerRequest):
    # Entrypoint that lists a folder or downloads a file
    try:
        return await main_explorer(body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
