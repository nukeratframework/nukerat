from infra.database.database import Process
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def main_process(content):
    # Main function that stores the process tree for the host
    host = content.get("host", "")
    task_tag = content.get("task_tag", "")
    tree = content.get("tree", "")

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

    try:
        await listener_utils.write(Process(tag=task_tag, host=host, tree=tree))
    except Exception as e:
        if "UNIQUE constraint" not in str(e):
            write_log(logger, "error", f"Unhandled exception | process | {e}")
            return {"status": "failure", "message": f"process write error: {e}"}
        await listener_utils.modify(
            Process,
            filters={"host": host},
            changes={"tag": task_tag, "tree": tree},
        )

    return {"status": "success", "message": "request processed successfully"}

