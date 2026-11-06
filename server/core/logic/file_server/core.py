import os

from fastapi.responses import FileResponse
from infra.general.create_log import logger, write_log
from logic.conclude_logic import conclude_request
from utils.iocs.endpoint.file_server import run as file_server_iocs_run
from .logic import list_files, delete_file, rename_file, upload_file, file_path


async def iocs_hook(action: str, tag: str, body: dict | None = None) -> None:
    payload = {"type": action, "tag": tag, **(body or {})}
    try:
        await file_server_iocs_run(payload)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | file_server/iocs | {e}")


async def fetch_files(tag: str):
    tag = (tag or "").strip()
    files = await list_files(tag)
    if files is None:
        return await conclude_request(
            {"status": "failure", "message": "File server not found"},
            status_code=404,
            type="file_server",
        )
    return await conclude_request(
        {"status": "success", "files": files},
        type="file_server",
    )


async def remove_file(tag: str, file_name: str):
    tag = (tag or "").strip()
    if not await delete_file(tag, file_name):
        return await conclude_request(
            {"status": "failure", "message": "File not found"},
            status_code=404,
            type="file_server",
        )
    return await conclude_request({"status": "success", "message": "File deleted"}, type="file_server")


async def patch_file(tag: str, file_name: str, body: dict):
    tag = (tag or "").strip()
    if not await rename_file(tag, file_name, body.get("new_file_name")):
        return await conclude_request(
            {"status": "failure", "message": "File not found"},
            status_code=404,
            type="file_server",
        )
    return await conclude_request({"status": "success", "message": "File renamed"}, type="file_server")


async def create_file(tag: str, body: dict):
    tag = (tag or "").strip()
    await iocs_hook("upload", tag, body)
    raw = body.get("bytes")
    if not await upload_file(tag, body.get("file_name"), raw):
        return await conclude_request(
            {"status": "failure", "message": "Upload failed"},
            status_code=400,
            type="file_server",
        )
    return await conclude_request({"status": "success", "message": "File uploaded"}, type="file_server")


async def download_file(tag: str, file_name: str):
    tag = (tag or "").strip()
    await iocs_hook("download", tag, {"file_name": file_name})
    path = await file_path(tag, file_name)
    if not path:
        return await conclude_request(
            {"status": "failure", "message": "File not found"},
            status_code=404,
            type="file_server",
        )
    return FileResponse(path, media_type="application/octet-stream", filename=os.path.basename(path))
