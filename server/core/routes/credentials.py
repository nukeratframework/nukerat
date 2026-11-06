from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.credentials.core import (
    create_credential,
    fetch_credentials,
    patch_credential,
    remove_credential,
)

router = APIRouter()


@router.get("/")
async def list_credentials(request: Request):
    # Entrypoint that lists the credentials
    try:
        return await fetch_credentials()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/")
async def create(request: Request):
    # Entrypoint that stores a credential
    try:
        return await create_credential(await request.json())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.patch("/{tag}")
async def patch(request: Request, tag: str):
    # Entrypoint that updates a credential
    try:
        return await patch_credential(tag, await request.json())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: str):
    # Entrypoint that deletes a credential
    try:
        return await remove_credential(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
