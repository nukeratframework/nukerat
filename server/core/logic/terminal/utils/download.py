import re

from infra.database.listener_utils import cleanup_download_tmp_for_tag_sync, unlink_download_tmp_path
from logic.terminal.utils.command import enqueue

from .general import reply

download_queue = {}
threads_of_download = {}


def download_queue_create(item_id, cmd_tag, file_name=None, host_tag=None):
    # Stores a new download in the queue
    name = (file_name or "").strip().replace("\\", "/").rsplit("/", 1)[-1] if file_name else ""
    download_queue[item_id] = {
        "id": item_id,
        "cmd_tag": cmd_tag,
        "host_tag": (host_tag or "").strip(),
        "file_name": name or "download",
        "active": True,
        "received_bytes": 0,
        "total_bytes": 0,
        "implant_task_id": "",
    }


def download_queue_read(item_id):
    # Reads one download from the queue
    row = download_queue.get(item_id)
    return dict(row) if isinstance(row, dict) else None


def download_queue_update(item_id, **fields):
    # Updates one download in the queue
    row = download_queue.get(item_id)
    if not isinstance(row, dict):
        return False
    row.update(fields)
    download_queue[item_id] = row
    return True


def download_queue_delete(item_id):
    # Deletes one download from the queue
    if item_id not in download_queue:
        return False
    del download_queue[item_id]
    threads_of_download.pop(item_id, None)
    return True


def download_targets(cmd_tag, download_id):
    # Finds the downloads that match the command or the id
    tag = (cmd_tag or "").strip()
    did = (download_id or "").strip() if download_id else ""
    out = []
    if did:
        row = download_queue_read(did)
        if row:
            out.append((did, row))
    elif tag:
        for item_id in list(download_queue.keys()):
            row = download_queue.get(item_id)
            if isinstance(row, dict) and (row.get("cmd_tag") or "").strip() == tag:
                out.append((item_id, dict(row)))
    return out


async def delete_tmp_and_dict(
    cmd_tag,
    download_id=None,
    done_path=None,
    *,
    host_tag=None,
    source_terminal=None,
    kill_implant=True,
    implant_task_id=None,
):
    # Stops the download and removes the tmp file and the queue row
    tag = (cmd_tag or "").strip()
    did = (download_id or "").strip() if download_id else ""
    src = (source_terminal or "").strip() or "gui-downloads"

    if kill_implant:
        killed = False
        for item_id, row in download_targets(cmd_tag, download_id):
            ht = (host_tag or row.get("host_tag") or "").strip()
            task_id = threads_of_download.get(item_id) or (row.get("implant_task_id") or "").strip()
            if not ht or not task_id:
                continue
            killed = True
            cmd = f"tasks kill {task_id}"
            await enqueue(
                ht,
                cmd,
                {
                    "source_terminal": src,
                    "mode": "tasks kill",
                    "args": task_id,
                    "bg": False,
                    "wait": None,
                },
                cmd,
            )
        if not killed:
            ht = (host_tag or "").strip()
            task_id = (implant_task_id or "").strip()
            if ht and task_id:
                cmd = f"tasks kill {task_id}"
                await enqueue(
                    ht,
                    cmd,
                    {
                        "source_terminal": src,
                        "mode": "tasks kill",
                        "args": task_id,
                        "bg": False,
                        "wait": None,
                    },
                    cmd,
                )

    if done_path is not None and done_path.is_file():
        unlink_download_tmp_path(done_path)
    elif tag:
        cleanup_download_tmp_for_tag_sync(tag)

    if did:
        download_queue_delete(did)
    elif tag:
        for item_id in list(download_queue.keys()):
            row = download_queue.get(item_id)
            if isinstance(row, dict) and (row.get("cmd_tag") or "").strip() == tag:
                download_queue_delete(item_id)


async def handle_download_queue_command(input_text, verb, source_terminal):
    # Lists or deletes a download from the queue
    if verb == "download list":
        rows = list(download_queue.values())
        if not rows:
            return reply("success", "No active downloads.", source_terminal)
        lines = [f"Active downloads ({len(rows)})", ""]
        for row in rows:
            received = int(row.get("received_bytes") or 0)
            total = int(row.get("total_bytes") or 0)
            if total > 0:
                pct = min(100, int(received * 100 / total))
                if total >= 1024 ** 2:
                    prog = f"{received / (1024 ** 2):.1f} MB / {total / (1024 ** 2):.1f} MB ({pct}%)"
                else:
                    prog = f"{received} / {total} B ({pct}%)"
            elif received > 0:
                prog = (
                    f"{received / (1024 ** 2):.1f} MB received (total unknown)"
                    if received >= 1024 ** 2
                    else f"{received} B received (total unknown)"
                )
            else:
                prog = "waiting"
            lines.extend([
                f"[*] {row.get('id', '—')}",
                "",
                f"File      :  {row.get('file_name') or 'download'}",
                f"Status    :  {'active' if row.get('active') else 'inactive'}",
                f"Progress  :  {prog}",
                "",
            ])
        return reply("success", "\n".join(lines).rstrip(), source_terminal)

    if verb == "download delete":
        match = re.search(r"--id\s+(\S+)", input_text)
        if not match:
            return reply("failure", "Usage: download delete --id <id>", source_terminal)
        item_id = match.group(1)
        row = download_queue_read(item_id)
        if not row:
            return reply("failure", f"Download id not found: {item_id}", source_terminal)
        host_tag = (row.get("host_tag") or "").strip()
        cmd_tag = (row.get("cmd_tag") or "").strip()
        await delete_tmp_and_dict(
            cmd_tag,
            item_id,
            host_tag=host_tag,
            source_terminal=source_terminal,
            kill_implant=False,
        )
        return reply("success", f"Download {item_id} removed.", source_terminal)

    return reply("failure", "Unknown download queue command.", source_terminal)
