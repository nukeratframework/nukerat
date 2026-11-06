import asyncio
import base64
from pathlib import Path
from fastapi.responses import JSONResponse
from logic.conclude_logic import conclude_request
from infra.database.database import sqlite_db, Folders
from utils.querys import create_queue_line, read_queue_line
from .utils import build_tree, mark_expanded


def read_tmp_output_file(output_file: Path) -> str | None:
    # Reads the tmp file as base64 and deletes it
    if not output_file.exists():
        return None
    raw_bytes = output_file.read_bytes()
    output_file.unlink(missing_ok=True)

    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        raw_bytes.decode("utf-8-sig", errors="replace")
    elif raw_bytes.startswith(b"\xff\xfe"):
        raw_bytes.decode("utf-16-le", errors="replace")
    elif raw_bytes.startswith(b"\xfe\xff"):
        raw_bytes.decode("utf-16-be", errors="replace")
    elif b"\x00" in raw_bytes:
        try:
            raw_bytes.decode("utf-16-le")
        except UnicodeDecodeError:
            raw_bytes.decode("utf-16-be", errors="replace")
    else:
        raw_bytes.decode("utf-8", errors="replace")

    return base64.b64encode(raw_bytes).decode("ascii")


async def get_file(content):
    # Waits for the file content and returns it
    host = content.get("host")
    path = content.get("path", "/")
    get_content = content.get("getContent")
    file_name = content.get("fileName")

    task_tag = await create_queue_line(
        host=host,
        qtype="folders",
        input=path,
        parameters={"getContent": get_content},
    )

    tmp_dir = Path(__file__).resolve().parents[3] / "infra" / "tmp"
    output_file = tmp_dir / f"{file_name}"

    delay = await sqlite_db.get_host_delay(host)
    total_wait_time = delay + 30.0
    iterations = int(total_wait_time / 0.2)

    for _ in range(iterations):
        # Queue error -------------------------------------

        task_error = await sqlite_db.check_task_error(task_tag)
        if task_error:
            return JSONResponse(content={
                "status": "failure",
                "error": task_error,
            })

        # --------------------------------------------------

        file_content_b64 = await asyncio.to_thread(read_tmp_output_file, output_file)
        if file_content_b64 is not None:
            return JSONResponse(content={
                "status": "success",
                "folders": [],
                "file_name": file_name,
                "file_content_b64": file_content_b64,
            })

        await asyncio.sleep(0.2)

    return JSONResponse(content={
        "status": "failure",
        "error": "Request timeout"
    })


async def get_folder(content):
    # Waits for the folder listing and returns the tree
    host = content.get("host")
    path = content.get("path", "/")
    get_content = content.get("getContent")
    auto_refresh = bool(content.get("autoRefresh"))

    if auto_refresh:
        task_tag = await create_queue_line(
            host=host,
            qtype="folders",
            input=path,
            parameters={"getContent": get_content},
        )

        delay = await sqlite_db.get_host_delay(host)
        total_wait_time = delay + 30.0
        iterations = int(total_wait_time / 0.2)

        for _ in range(iterations):
            # Queue error -------------------------------------

            task_error = await sqlite_db.check_task_error(task_tag)
            if task_error:
                return JSONResponse(content={
                    "status": "failure",
                    "error": task_error,
                })

            # --------------------------------------------------

            await asyncio.sleep(0.2)
            row = await read_queue_line(task_tag)

            if row and row.is_completed == 1:
                task_error = await sqlite_db.check_task_error(task_tag)
                if task_error:
                    return JSONResponse(content={
                        "status": "failure",
                        "error": task_error,
                    })
                break

    rows = await sqlite_db.read(Folders, host=host)
    flat_data = {}

    for row in rows:
        flat_data[row.path] = {
            "type": row.type,
            "modified": row.modified,
            "size": row.size
        }

    tree_folders = [await mark_expanded(await build_tree(flat_data))] if flat_data else []

    return JSONResponse(content={
        "status": "success",
        "folders": tree_folders,
    })


async def main_explorer(content):
    # Routes the explorer request to a file or a folder
    is_file_request = bool(content.get("getContent"))

    if is_file_request:
        return await conclude_request(await get_file(content), body=content, type="explorer")

    return await conclude_request(await get_folder(content), body=content, type="explorer")
    
