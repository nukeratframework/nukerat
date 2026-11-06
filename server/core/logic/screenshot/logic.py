import asyncio
import base64
import hashlib
from pathlib import Path

from infra.general.create_log import logger, write_log
from logic.utils.disconnect import check_client_disconnect

snap_dir = Path(__file__).resolve().parents[3] / "infra" / "tmp"


def load_screenshot_snapshot(path: Path):
    # Reads the screenshot file and its hash
    if not path.is_file():
        return "empty", None, None
    try:
        data = path.read_bytes()
        return hashlib.sha256(data).hexdigest(), data, None
    except Exception as e:
        return None, None, e


async def read_screenshot(host_tag, client_hash=None, long_polling=False, request=None):
    # Returns the screenshot and waits when the hash is unchanged
    p = snap_dir / f"{host_tag}.jpg"

    while True:
        current_hash, data, err = await asyncio.to_thread(load_screenshot_snapshot, p)
        if err is not None:
            write_log(logger, "error", f"Unhandled exception | screenshot | {err}")
            return {"status": "failure", "message": str(err)}

        if not long_polling or not client_hash or client_hash != current_hash:
            break
        # ========== orphaned connection =========
        if await check_client_disconnect(request, 1.0):
            break

    if current_hash == "empty":
        return {"status": "success", "content": "empty", "hash": "empty"}
    return {
        "status": "success",
        "content": base64.b64encode(data).decode(),
        "hash": current_hash,
    }
