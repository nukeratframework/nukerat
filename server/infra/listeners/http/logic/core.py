from .actions import main_actions
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log
from ..utils.crypt import respond


async def main_core(body, data, config, request=None, aes_key=None):
    # Logs the checkin, marks the host active, and calls the actions
    try:
        await listener_utils.log_checkin(body)
        await listener_utils.set_status_active(body)
        return await main_actions(data, config, request, aes_key, body)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http/core | {e}")
        return await respond(aes_key, {"status": "failure", "error": "internal error"}, config=config)