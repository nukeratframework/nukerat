import json

from infra.database.database import Queue, Terminal
from infra.database.listener_utils import listener_utils
from infra.general.create_log import listener_logger, write_log

from .download import is_download_queue, main_download, validate_download_queue


async def main_terminal(content):
    # Main function that stores terminal output or routes a download
    task_tag = content.get("task_tag", "")
    output = content.get("output", "")

    if not task_tag:
        return {"status": "failure", "message": "missing tas tag"}

    queue_rows = await listener_utils.read(Queue, tag=task_tag)
    if not queue_rows:
        return {"status": "failure", "message": "queue not found"}

    queue_row = queue_rows[0]
    is_download = is_download_queue(queue_row)

    if is_download:
        queue_fail = await validate_download_queue(task_tag, content, queue_row)
        if queue_fail:
            return queue_fail
    else:
        queue_check = await listener_utils.check_queue_tag(task_tag)
        if queue_check.get("status") != "success":
            return {
                "status": "failure",
                "message": queue_check.get("message") or queue_check.get("error") or "queue check failed",
            }

    if content.get("error"):
        return await listener_utils.apply_task_error(task_tag, content.get("error"))

    source_terminal = task_tag

    try:
        parameters = json.loads(queue_row.parameters or "{}")
        source_terminal = parameters.get("source_terminal") or parameters.get("terminal_id") or task_tag
    except Exception as e:
        write_log(listener_logger, "error", f"Unhandled exception | terminal output | {e}")
        source_terminal = task_tag

    terminal_rows = await listener_utils.read(Terminal, tag=task_tag)

    if is_download:
        return await main_download(content, task_tag, queue_row, terminal_rows, source_terminal)

    if not output or output == "" or output == " ":
        output = " "
    if not output.endswith("\n"):
        output += "\n"

    if terminal_rows:
        if terminal_rows[0].output:
            return {"status": "failure", "message": "output already received"}

        await listener_utils.modify(
            Terminal,
            filters={"id": terminal_rows[0].id},
            changes={"output": output},
        )
    else:
        await listener_utils.write(
            Terminal(
                terminal_id=source_terminal,
                tag=task_tag,
                host=queue_row.host,
                input=queue_row.input,
                output=output,
            )
        )

    queue_result = await listener_utils.set_queue_output_ok(task_tag)
    if queue_result.get("status") != "success":
        return {"status": "failure", "message": "queue error"}

    return {"status": "success", "message": "output received successfully"}
