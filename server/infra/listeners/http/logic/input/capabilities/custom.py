import os
import json
from infra.database.listener_utils import listener_utils
from logic.terminal.mapping import commands 
from .get_content import *
from infra.general.create_log import logger, write_log


async def custom_input(row_data: dict) -> dict:
    # Fills the command payload from the configured content handler
    task_tag = row_data.get("task_tag", "")
    raw_params = row_data.get("parameters", "{}")

    parameters = json.loads(raw_params) if isinstance(raw_params, str) else raw_params
    call_args = parameters.get("args", False)
    inLine = parameters.get("inline", False)
    content_handler = parameters.get("content_handler", "")
    
    if not content_handler:
        return row_data

    try:
        if content_handler == "dotnet":
            row_data["input"] = await get_dotnet_content(parameters, call_args, inline=inLine)
        elif content_handler == "bof":
            await get_file_bytes_path(parameters, row_data, call_args)
            await get_bof_content(parameters, row_data)
        elif content_handler == "shellcode":
            row_data["input"] = await get_shellcode_content(parameters, task_tag)
            row_data["parameters"] = parameters # For RWX flag
        elif content_handler in ("migrate", "getsystem"):
            row_data["input"] = await get_migrate_content(row_data.get("host", ""))
        elif content_handler == "dll":
            row_data["input"] = await get_raw_bytes_content(parameters)
        elif content_handler == "donut":
            row_data["input"] = await get_donut_content(parameters, call_args, task_tag)
            row_data["parameters"] = parameters # For RWX flag
        elif content_handler == "raw_bytes":
            row_data["input"] = await get_raw_bytes_content(parameters)
        elif content_handler == "upload":
            row_data["input"] = await get_tmp_content(parameters)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | custom input | {e}")
        await listener_utils.apply_task_error(task_tag, str(e))
        return None

    return row_data
