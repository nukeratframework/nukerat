from sqlalchemy.exc import IntegrityError
from infra.database.database import Keylogger
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def main_keylogger(content):
    # Stores the captured keystrokes in the database
    tag = content.get("task_tag", "")
    host_tag = content.get("host_tag", "")
    keys = content.get("content", "")

    if not tag:
        return {"status": "failure", "message": "missing task_tag"}

    if not keys:
        return {"status": "failure", "message": "missing content"}

    try:
        await listener_utils.write(Keylogger(tag=tag, content=keys, host_tag=host_tag))
    except IntegrityError:
        return {"status": "failure", "message": "keylogger tag already exists"}
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | keylogger | {e}")
        return {"status": "failure", "message": str(e)}

    return {"status": "success", "message": "keylogger saved"}
