from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from core.logic.auth.core import main_auth
from infra.general.create_log import logger, write_log
from schemas.auth import LoginRequest

router = APIRouter()


@router.post("/login")
async def login(request: Request, body: LoginRequest):
    # Entrypoint that logs the operator in
    try:
        return await main_auth(body.model_dump(by_alias=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/check")
async def check():
    # Entrypoint that checks if the session is still valid
    return {"status": "success"}
