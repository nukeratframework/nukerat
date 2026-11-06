import asyncio
import json
import os
from infra.database.database import Listener, sqlite_db

main_loop = None

def parse_config_port(cfg, key):
    # Reads a port number from the listener config
    val = cfg.get(key)
    if val is None or str(val).strip() == "":
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


async def find_by_port(port):
    # Finds the file server listener that owns the port
    port = int(port)
    for row in await sqlite_db.read(Listener):
        if row.type != "file_server":
            continue
        try:
            cfg = json.loads(row.config or "{}")
        except json.JSONDecodeError:
            continue
        ports = [parse_config_port(cfg, k) for k in ("portToOpen", "port")]
        if port not in [p for p in ports if p is not None]:
            continue
        return {
            "tag": (cfg.get("name") or row.tag or "").strip(),
            "host": (cfg.get("host") or "").strip(),
            "contentDir": cfg.get("contentDir"),
        }
    return None


def safe_name(name):
    # Only sanitizes the file name
    name = os.path.basename(str(name or "").replace("\\", "/")).strip()
    if not name or name in (".", ".."):
        return None
    return name


def upload_file(content_dir, source_path):
    # Copies a file into the file server folder
    source_path = str(source_path).strip()
    if not os.path.isfile(source_path):
        return "File not found"
    name = safe_name(source_path)
    if not name:
        return "Invalid file name"
    root = content_dir
    if not root or not os.path.isdir(root):
        return "File server content dir not found"
    with open(source_path, "rb") as src, open(os.path.join(root, name), "wb") as dst:
        dst.write(src.read())
    return "File uploaded"


def delete_file(content_dir, nome):
    # Deletes a file from the file server folder
    nome = safe_name(nome)
    if not nome:
        return "Missing file name"
    root = content_dir
    if not root or not os.path.isdir(root):
        return "File server content dir not found"
    path = os.path.join(root, nome)
    if not os.path.isfile(path):
        return "File not found"
    os.remove(path)
    return "File deleted"


async def send_upload(port, path):
    # Uploads a file through the file server on that port
    row = await find_by_port(port)
    if not row:
        return "File server not found"
    return await asyncio.to_thread(upload_file, row.get("contentDir"), path)


async def send_delete(port, nome):
    # Deletes a file from the file server on that port
    row = await find_by_port(port)
    if not row:
        return "File server not found"
    return await asyncio.to_thread(delete_file, row.get("contentDir"), nome)


def dispatch_upload(port, path):
    # Runs the upload call on the main loop
    future = asyncio.run_coroutine_threadsafe(send_upload(port, path), main_loop)
    return future.result()


def dispatch_delete(port, nome):
    # Runs the delete call on the main loop
    future = asyncio.run_coroutine_threadsafe(send_delete(port, nome), main_loop)
    return future.result()
