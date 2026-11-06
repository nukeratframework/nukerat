import asyncio

from infra.database.database import Queue, sqlite_db


async def wait_nukescript_validation(tag):
    # Waits until the nukescript approves or rejects the queue line
    for _ in range(30):
        rows = await sqlite_db.read(Queue, tag=tag)
        if not rows:
            return
        t = rows[0].nukescript_trigger
        if t == "approved":
            return
        if t == "rejected":
            if rows[0].is_completed != 1:
                await sqlite_db.modify(Queue, {"tag": tag}, {"is_completed": 1})
            return
        await asyncio.sleep(1)
    await sqlite_db.modify(Queue, {"tag": tag}, {"error": "Error: Worker validation timeout."})
