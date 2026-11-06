import asyncio
import hashlib

from logic.file_server.logic import decode_bytes, read_file
from utils.iocs.helpers import save_iocs


def hash_file_items(raw: bytes) -> list[tuple[str, str, int]]:
    # Builds md5, sha1 and sha256 hashes for the file bytes
    return [
        ("md5", hashlib.md5(raw).hexdigest(), 5),
        ("sha1", hashlib.sha1(raw).hexdigest(), 5),
        ("sha256", hashlib.sha256(raw).hexdigest(), 5),
    ]


async def run(body: dict) -> None:
    # Hashes an uploaded or downloaded file and stores the iocs
    action = body.get("type")
    tag = body.get("tag") or body.get("name")

    host_tag = "campaign"
    for key in ("host_tag", "hostTag", "host", "session", "tag", "name"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            host_tag = value.strip()
            break

    raw = None

    if action == "upload":
        raw = await decode_bytes(body.get("bytes"))

    if action == "download":
        data = await read_file(tag, body.get("file_name"))
        if data:
            raw = await decode_bytes(data)

    if not raw:
        return

    items = await asyncio.to_thread(hash_file_items, raw)
    await save_iocs(None, items)
