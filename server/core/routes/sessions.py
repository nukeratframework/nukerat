from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from core.logic.sessions.core import fetch_sessions, patch_session, remove_session
from infra.general.create_log import logger, write_log
from logic.conclude_logic import conclude_request
from schemas.sessions import ListSessionsQuery, PatchSessionRequest

router = APIRouter()


@router.get("/")
async def list_sessions(request: Request, query: Annotated[ListSessionsQuery, Query()]):
    # Entrypoint that lists the sessions
    try:
        return await fetch_sessions(query.model_dump(), request)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.patch("/{tag}")
async def patch(request: Request, tag: str, body: PatchSessionRequest):
    # Entrypoint that updates a session
    try:
        return await conclude_request(await patch_session(tag, body.model_dump()), type="sessions")
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: str):
    # Entrypoint that deletes a session
    try:
        return await conclude_request(await remove_session(tag), type="sessions")
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
