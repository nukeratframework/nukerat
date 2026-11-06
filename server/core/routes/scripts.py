from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.scripts.core import create_script, fetch_scripts, patch_script, remove_script
from schemas.scripts import CreateScriptRequest, DeleteScriptRequest, PatchScriptRequest, ScriptTag

router = APIRouter()


@router.get("/")
async def list_scripts(request: Request):
    # Entrypoint that lists the scripts
    try:
        return await fetch_scripts()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/")
async def create(request: Request, body: CreateScriptRequest):
    # Entrypoint that creates a script
    try:
        return await create_script(body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.patch("/{tag}")
async def patch(request: Request, tag: ScriptTag, body: PatchScriptRequest):
    # Entrypoint that updates a script
    try:
        return await patch_script(tag, body.model_dump(exclude_none=True))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: ScriptTag, body: DeleteScriptRequest):
    # Entrypoint that deletes a script
    try:
        return await remove_script(tag, body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
