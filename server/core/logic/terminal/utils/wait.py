import asyncio
import json
from pathlib import Path

from infra.database.database import Queue, Terminal, sqlite_db
from logic.utils.disconnect import check_client_disconnect
from .download import delete_tmp_and_dict, download_queue_read, download_queue_update
from .general import reply


def _download_progress_from_output(out: str, completed: bool) -> tuple[int, int]:
    # Reads received and total bytes from the download output
    text = (out or "").strip()
    received = 0
    total = 0
    if not text:
        return received, total
    if "|" in text:
        parts = text.split("|")
        try:
            if len(parts) > 1:
                received = int(parts[1])
        except ValueError:
            received = 0
        try:
            if len(parts) > 2:
                total = int(parts[2])
        except ValueError:
            total = 0
        tmp = Path(parts[0])
        if tmp.is_file():
            received = max(received, tmp.stat().st_size)
    elif completed:
        candidate = Path(text)
        if candidate.is_file():
            size = candidate.stat().st_size
            received = total = size
    if total <= 0 and received > 0 and completed:
        total = received
    return received, total


def _download_progress_event(received: int, total: int, source_terminal: str) -> dict:
    # Builds the download progress event
    percent = 0
    mb_remaining = 0.0
    if total > 0:
        percent = min(100, int(received * 100 / total))
        mb_remaining = round(max(0.0, (total - received) / (1024 * 1024)), 2)
    return {
        "status": "progress",
        "received": received,
        "total": total,
        "percent": percent,
        "mb_remaining": mb_remaining,
        "source_terminal": source_terminal,
    }


async def wait_response(cmd_tag, host_tag, command, source_terminal, params):
    # Waits for the terminal output or a timeout
    if params.get("bg"):
        return reply("success", "Successfully executed in background.", source_terminal)
    if params.get("wait") is not None:
        delay = int(params["wait"])
    else:
        delay = 99999 if command.startswith("ns-") else int(await sqlite_db.get_host_delay(host_tag)) + 30
    for _ in range(delay):
        task_error = await sqlite_db.check_task_error(cmd_tag)
        if task_error:
            return reply("failure", task_error, source_terminal)

        custom = await sqlite_db.check_task_custom_response(cmd_tag)
        if custom:
            return reply("failure", custom, source_terminal, custom_response=custom)

        await asyncio.sleep(0.2)
        rows = await sqlite_db.read(Terminal, tag=cmd_tag)
        if rows and (rows[0].output or "").strip():
            out = rows[0].output
            return reply("success", out, source_terminal)
        await asyncio.sleep(1)

    return reply("failure", "Implant request timeout", source_terminal)


async def wait_download_response(cmd_tag, host_tag, source_terminal, params, request=None):
    # Streams the download progress and the file chunks
    done_path = None
    download_id = params.get("download_id")
    cancel_msg = "Download cancelled\n"

    if params.get("bg"):
        yield json.dumps({
            "status": "success",
            "message": "Successfully executed in background.",
            "source_terminal": source_terminal,
        }, ensure_ascii=False) + "\n"
        return

    delay = int(await sqlite_db.get_host_delay(host_tag)) + 120
    remaining = delay
    last_progress = ""
    last_progress_yield: tuple[int, int, int] | None = None
    stream_chunk = 512 * 1024
    saw_implant_chunk = False

    while remaining > 0:
        if download_id:
            row = download_queue_read(download_id)
            if not row or not row.get("active"):
                yield json.dumps({
                    "status": "failure",
                    "message": cancel_msg,
                    "source_terminal": source_terminal,
                }, ensure_ascii=False) + "\n"
                return

        await asyncio.sleep(0.2)
        rows = await sqlite_db.read(Terminal, tag=cmd_tag)
        queue_rows = await sqlite_db.read(Queue, tag=cmd_tag)
        completed = bool(queue_rows and queue_rows[0].is_completed == 1)
        out = (rows[0].output or "").strip() if rows else last_progress
        received, total = _download_progress_from_output(out, completed)
        if received > 0:
            saw_implant_chunk = True
        if download_id:
            download_queue_update(
                download_id,
                received_bytes=received,
                total_bytes=total,
            )
            evt = _download_progress_event(received, total, source_terminal)
            yield_key = (evt["received"], evt["total"], evt["percent"])
            if yield_key != last_progress_yield:
                last_progress_yield = yield_key
                yield json.dumps(evt, ensure_ascii=False) + "\n"

        task_error = await sqlite_db.check_task_error(cmd_tag)
        if task_error:
            if not saw_implant_chunk:
                await delete_tmp_and_dict(
                    cmd_tag, download_id, done_path, host_tag=host_tag, source_terminal=source_terminal,
                )
            yield json.dumps({
                "status": "failure",
                "message": task_error,
                "source_terminal": source_terminal,
            }, ensure_ascii=False) + "\n"
            return

        custom = await sqlite_db.check_task_custom_response(cmd_tag)
        if custom:
            if not saw_implant_chunk:
                await delete_tmp_and_dict(
                    cmd_tag, download_id, done_path, host_tag=host_tag, source_terminal=source_terminal,
                )
            yield json.dumps({
                "status": "failure",
                "message": custom,
                "custom_response": custom,
                "source_terminal": source_terminal,
            }, ensure_ascii=False) + "\n"
            return
        if rows:
            out = (rows[0].output or "").strip()
            if out and completed and "|" not in out:
                candidate = Path(out)
                if candidate.is_file():
                    done_path = candidate
                    saw_implant_chunk = True
                    break
            if out != last_progress:
                last_progress = out
                remaining = delay
        remaining -= 1
        # ========== orphaned connection =========
        if await check_client_disconnect(request, 1.0):
            if not saw_implant_chunk:
                await delete_tmp_and_dict(
                    cmd_tag, download_id, done_path, host_tag=host_tag, source_terminal=source_terminal,
                )
            yield json.dumps({
                "status": "failure",
                "message": cancel_msg,
                "source_terminal": source_terminal,
            }, ensure_ascii=False) + "\n"
            return
    if not done_path or not done_path.is_file():
        if not saw_implant_chunk:
            await delete_tmp_and_dict(
                cmd_tag, download_id, done_path, host_tag=host_tag, source_terminal=source_terminal,
            )
        yield json.dumps({
            "status": "failure",
            "message": "Download timed out waiting for the next chunk from implant",
            "source_terminal": source_terminal,
        }, ensure_ascii=False) + "\n"
        return
    file_size = done_path.stat().st_size
    sent = 0
    with done_path.open("rb") as fh:
        while sent < file_size:
            if download_id:
                row = download_queue_read(download_id)
                if not row or not row.get("active"):
                    yield json.dumps({
                        "status": "failure",
                        "message": cancel_msg,
                        "source_terminal": source_terminal,
                    }, ensure_ascii=False) + "\n"
                    return

            # ========== orphaned connection =========
            if await check_client_disconnect(request, 0):
                await delete_tmp_and_dict(
                    cmd_tag, download_id, done_path, kill_implant=False,
                )
                yield json.dumps({
                    "status": "failure",
                    "message": cancel_msg,
                    "source_terminal": source_terminal,
                }, ensure_ascii=False) + "\n"
                return

            piece = fh.read(min(stream_chunk, file_size - sent))
            if not piece:
                yield json.dumps({
                    "status": "failure",
                    "message": "Download stream interrupted",
                    "source_terminal": source_terminal,
                }, ensure_ascii=False) + "\n"
                return
            sent += len(piece)
            yield json.dumps({
                "status": "chunk",
                "size": len(piece),
                "total": file_size,
                "received": sent,
                "more": sent < file_size,
                "source_terminal": source_terminal,
            }, ensure_ascii=False) + "\n"
            yield piece

    yield json.dumps({
        "status": "success",
        "message": "Download complete",
        "download": True,
        "source_terminal": source_terminal,
    }, ensure_ascii=False) + "\n"
    if done_path.is_file():
        await delete_tmp_and_dict(
            cmd_tag, download_id, done_path, kill_implant=False,
        )
