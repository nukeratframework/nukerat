from infra.database.listener_utils import listener_utils


async def abort_task(queue_tag, message):
    # Aborts the queued task and returns a failure
    if queue_tag:
        await listener_utils.abort_task_queue(queue_tag, message or "Auto killed task")
    return {"status": "failure", "error": message}