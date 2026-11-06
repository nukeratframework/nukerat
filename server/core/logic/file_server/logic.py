import asyncio
import base64
import os
from datetime import datetime

from infra.listeners.file_server.manage import file_server_listener
from infra.general.create_log import logger, write_log


def resolve_content_dir(tag: str) -> str | None:
    if not tag:
        return None
    for row in file_server_listener.all():
        if tag in (row.get("tag"), row.get("name"), row.get("session_id")):
            path = row.get("contentDir")
            if path and os.path.isdir(path):
                return path
    return None


async def content_dir(tag):
    return await asyncio.to_thread(resolve_content_dir, tag)


async def safe_name(name):
    name = os.path.basename(str(name or "").replace("\\", "/"))
    if not name or name in (".", ".."):
        return None
    return name


def format_size(bytes_count):
    if bytes_count == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(bytes_count)
    unit = 0
    while size >= 1024 and unit < len(units) - 1:
        size /= 1024
        unit += 1
    if unit == 0:
        return f"{int(size)} {units[unit]}"
    text = f"{size:.2f}".rstrip("0").rstrip(".")
    return f"{text} {units[unit]}"


def list_files_sync(root: str) -> list[dict]:
    rows = []
    for name in os.listdir(root):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        rows.append(
            (
                stat.st_mtime,
                {
                    "id": name,
                    "name": name,
                    "size": format_size(stat.st_size),
                    "upload_date": datetime.fromtimestamp(stat.st_mtime).strftime("%Y/%m/%d - %H:%M"),
                },
            )
        )
    rows.sort(key=lambda row: row[0], reverse=True)
    return [row[1] for row in rows]


async def list_files(tag):
    root = await content_dir(tag)
    if not root:
        return None
    return await asyncio.to_thread(list_files_sync, root)


def delete_file_sync(root: str, name: str) -> bool:
    path = os.path.join(root, name)
    if not os.path.isfile(path):
        return False
    os.remove(path)
    return True


async def delete_file(tag, file_name):
    root = await content_dir(tag)
    name = await safe_name(file_name)
    if not root or not name:
        return False
    return await asyncio.to_thread(delete_file_sync, root, name)


def rename_file_sync(root: str, old: str, new: str) -> bool:
    src = os.path.join(root, old)
    dst = os.path.join(root, new)
    if not os.path.isfile(src) or os.path.exists(dst):
        return False
    os.rename(src, dst)
    return True


async def rename_file(tag, file_name, new_file_name):
    root = await content_dir(tag)
    old = await safe_name(file_name)
    new = await safe_name(new_file_name)
    if not root or not old or not new:
        return False
    return await asyncio.to_thread(rename_file_sync, root, old, new)


def upload_file_sync(root: str, name: str, raw: bytes) -> bool:
    with open(os.path.join(root, name), "wb") as f:
        f.write(raw)
    return True


async def upload_file(tag, file_name, raw):
    root = await content_dir(tag)
    name = await safe_name(file_name)
    if not root or not name or raw is None:
        return False
    return await asyncio.to_thread(upload_file_sync, root, name, raw)


def file_path_sync(root: str, name: str) -> str | None:
    path = os.path.join(root, name)
    if not os.path.isfile(path):
        return None
    return path


async def file_path(tag, file_name):
    root = await content_dir(tag)
    name = await safe_name(file_name)
    if not root or not name:
        return None
    return await asyncio.to_thread(file_path_sync, root, name)


def read_file_sync(root: str, name: str) -> str | None:
    path = os.path.join(root, name)
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


async def read_file(tag, file_name):
    root = await content_dir(tag)
    name = await safe_name(file_name)
    if not root or not name:
        return None
    return await asyncio.to_thread(read_file_sync, root, name)


def decode_bytes_sync(value) -> bytes | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value
    text = str(value).strip()
    if not text:
        return None
    return base64.b64decode(text)


async def decode_bytes(value):
    try:
        return await asyncio.to_thread(decode_bytes_sync, value)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | file_server | {e}")
        return None
