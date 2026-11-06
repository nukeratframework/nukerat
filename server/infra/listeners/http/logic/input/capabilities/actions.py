from infra.database.database import Queue
from infra.database.listener_utils import listener_utils


async def check_actions(data):
    # Marks a terminate command as completed in the queue
    if not data:
        return
    
    if data.get("type") == "terminal" and data.get("input").startswith("terminate"):
        await listener_utils.modify(Queue, {"tag": data.get("task_tag")}, {"is_completed": 1})