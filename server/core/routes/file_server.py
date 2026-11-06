from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.file_server.core import (
    create_file,
    download_file,
    fetch_files,
    patch_file,
    remove_file,
)
from schemas.file_server import (
    FileServerFileName,
    FileServerRenameRequest,
    FileServerTag,
)

router = APIRouter()


@router.get("/{tag}")
async def list_files(request: Request, tag: FileServerTag):
    # Entrypoint that lists the files of the file server
    try:
        return await fetch_files(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.get("/{tag}/files/{file_name}/download")
async def download(request: Request, tag: FileServerTag, file_name: FileServerFileName):
    # Entrypoint that downloads a file from the file server
    try:
        return await download_file(tag, file_name)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/{tag}/files/{file_name}")
async def upload(request: Request, tag: FileServerTag, file_name: FileServerFileName):
    # Entrypoint that uploads a file to the file server
    try:
        return await create_file(tag, {"file_name": file_name, "bytes": await request.body()})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.patch("/{tag}/files/{file_name}")
async def rename(
    request: Request,
    tag: FileServerTag,
    file_name: FileServerFileName,
    body: FileServerRenameRequest,
):
    # Entrypoint that renames a file on the file server
    try:
        return await patch_file(tag, file_name, body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}/files/{file_name}")
async def delete(request: Request, tag: FileServerTag, file_name: FileServerFileName):
    # Entrypoint that deletes a file from the file server
    try:
        return await remove_file(tag, file_name)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
