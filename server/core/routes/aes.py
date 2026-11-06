from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.aes.core import create_aes_key

router = APIRouter()


@router.post("/create")
async def generate(request: Request):
    # Entrypoint that creates an aes key
    try:
        return await create_aes_key()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
