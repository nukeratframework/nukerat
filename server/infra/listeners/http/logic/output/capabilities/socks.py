import json
from infra.database.database import Queue, Terminal
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def main_socks(content):
    # Main function that stores the socks or port forward output
    task_tag = content.get("task_tag", "")
    output = content.get("output", "")

    if not task_tag:
        return {"status": "failure", "message": "missing task tag"}

    queue_check = await listener_utils.check_queue_tag(task_tag)
    if queue_check.get("status") != "success":
        return {"status": "failure", "message": "queue check failed"}

    queue_rows = await listener_utils.read(Queue, tag=task_tag)
    if not queue_rows:
        return {"status": "failure", "message": "queue not found"}

    queue_row = queue_rows[0]
    terminal_rows = await listener_utils.read(Terminal, tag=task_tag)

    if terminal_rows and terminal_rows[0].output:
        return {"status": "failure", "message": "output already received"}

    if not output:
        output = '{"ok":false,"error":"empty output"}'

    if terminal_rows:
        await listener_utils.modify(
            Terminal,
            filters={"id": terminal_rows[0].id},
            changes={"output": output},
        )
    else:
        await listener_utils.write(
            Terminal(
                terminal_id=task_tag,
                tag=task_tag,
                host=queue_row.host,
                input=queue_row.input,
                output=output,
            )
        )

    queue_result = await listener_utils.set_queue_output_ok(task_tag)
    if queue_result.get("status") != "success":
        return {"status": "failure", "message": "queue error"}

    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as e:
        write_log(logger, "error", f"Unhandled exception | socks output | {e}")

    return {"status": "success", "message": "output received successfully"}
