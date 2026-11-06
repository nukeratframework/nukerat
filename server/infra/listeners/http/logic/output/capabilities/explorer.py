import base64
import json
from pathlib import Path
from infra.database.database import Folders
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


def has_get_content(content, parameters):
    # Checks if this explorer result is a file download
    if content.get("get_content") is True:
        return True

    if isinstance(parameters, dict):
        return parameters.get("getContent") is True

    if isinstance(parameters, str):
        try:
            parsed = json.loads(parameters)
            return isinstance(parsed, dict) and parsed.get("getContent") is True
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | explorer parameters | {e}")
            return False

    return False

async def main_explorer(content):
    # Main function that stores folder rows or saves a downloaded file
    host = content.get("host", "")
    task_tag = content.get("task_tag", "")
    folders_content = content.get("content", [])
    parameters = content.get("parameters", {})
    is_file_download = has_get_content(content, parameters)

    # Sanitization 
    
    if not task_tag:
        return {"status": "failure", "message": "missing tag"}

    queue_check = await listener_utils.check_queue_tag(task_tag)
    
    if queue_check.get("status") != "success":
        return {"status": "failure", "message": "queue check failed"}

    if content.get("error"):
        return await listener_utils.apply_task_error(task_tag, content.get("error"))

    queue_result = await listener_utils.set_queue_output_ok(task_tag)
    
    if queue_result.get("status") != "success":
        return {"status": "failure", "message": "queue error"}
    
    # Process content ------------------------------------------------
    
    # Folders
    if not is_file_download:
        if not isinstance(folders_content, list):
            return {"status": "failure", "message": "content must be a list"}

        for item in folders_content:

            if not isinstance(item, dict):
                return {"status": "failure", "message": "invalid content item"}
        
            path = item.get("path", "")
            entry_type = item.get("type", "")
            last_edit = item.get("lastEdit", "")
            size = item.get("size", "")

            if not path or not entry_type or not last_edit or not size:
                return {"status": "failure", "message": "invalid folder item fields"}
            
            try:
                await listener_utils.write(
                    Folders(
                        host=host,
                        path=path,
                        type=entry_type,
                        modified=last_edit,
                        size=size,
                    )
                )

            except Exception as e:
                if "UNIQUE constraint" in str(e):
                    existing_same_host = await listener_utils.read(Folders, host=host, path=path)
                    filters = {"host": host, "path": path} if existing_same_host else {"path": path}
                    await listener_utils.modify(
                        Folders,
                        filters=filters,
                        changes={
                            "host": host,
                            "type": entry_type,
                            "modified": last_edit,
                            "size": size,
                        },
                    )
                    continue
                write_log(logger, "error", f"Unhandled exception | explorer | {e}")
                return {"status": "failure", "message": f"folder write error: {e}"}
    else:
        # File download
        raw_content = content.get("content", "")
        # if not isinstance(raw_content, str) or not raw_content:
        #     return {"status": "failure", "message": "invalid file content"}

        try:
            decoded_content = base64.b64decode(raw_content, validate=True)
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | explorer base64 | {e}")
            return {"status": "failure", "message": "invalid base64 file content"}

        output_path = Path(__file__).resolve().parents[5] / "tmp" / f"{content.get('file_name')}"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(decoded_content)

    return {"status": "success", "message": "request processed successfully"}
