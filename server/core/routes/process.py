from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from infra.general.create_log import logger, write_log
from logic.process.core import main_process
from schemas.process import ProcessRequest

router = APIRouter()


@router.post("/")
async def root(request: Request, body: ProcessRequest):
    # Entrypoint that lists the processes of the host
    try:
        return await main_process(body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
