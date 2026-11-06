import base64
from io import BytesIO
from pathlib import Path
from PIL import Image
from infra.general.create_log import logger, write_log


async def main_screenshot(content):
    # Decodes the screenshot and saves it as a jpeg file
    tag = content.get("task_tag", "")
    host_tag = content.get("host_tag", "")
    data = content.get("content", "")

    if not tag:
        return {"status": "failure", "message": "missing task_tag"}

    if not data:
        return {"status": "failure", "message": "missing content"}

    path = Path(__file__).resolve().parents[5] / "tmp" / f"{host_tag}.jpg"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = base64.b64decode(data, validate=True)
        if len(raw) < 8:
            return {"status": "failure", "message": "content too short"}
        img = Image.open(BytesIO(raw))
        img.load()
        img.convert("RGB").save(path, "JPEG", quality=90)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | screenshot | {e}")
        return {"status": "failure", "message": str(e)}

    return {"status": "success", "message": "screenshot saved"}
