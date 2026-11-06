from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from core.logic.implants.core import main_implants
from infra.general.create_log import logger, write_log
from schemas.implants import ImplantRequest

router = APIRouter()


@router.post("/")
async def root(request: Request, body: ImplantRequest):
    # Entrypoint that builds an implant
    try:
        return await main_implants(body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
