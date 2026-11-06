import asyncio
import json
from logic.conclude_logic import conclude_request
from infra.database.database import sqlite_db, Process
from utils.querys import create_queue_line, read_queue_line


async def _parse_tree(raw_tree):
    # Turns the process tree text into a list
    if not raw_tree:
        return []

    try:
        parsed_tree = json.loads(raw_tree)
        return parsed_tree if isinstance(parsed_tree, list) else []
    except json.JSONDecodeError:
        return []


async def main_process(content):
    # Waits for the process tree and returns it
    host = content.get("host")

    task_tag = await create_queue_line(
        host=host,
        qtype="process",
        input="process",
        parameters="{}",
    )

    delay = await sqlite_db.get_host_delay(host)
    total_wait_time = delay + 30.0
    iterations = int(total_wait_time / 0.2)

    for _ in range(iterations):
        task_error = await sqlite_db.check_task_error(task_tag)
        if task_error:
            return await conclude_request(
                {"status": "failure", "error": task_error},
                body=content,
                type="process",
            )

        await asyncio.sleep(0.2)
        row = await read_queue_line(task_tag)

        if row and row.is_completed == 1:
            task_error = await sqlite_db.check_task_error(task_tag)
            if task_error:
                return await conclude_request(
                    {"status": "failure", "error": task_error},
                    body=content,
                    type="process",
                )
            break
    else:
        return await conclude_request(
            {"status": "failure", "error": "Request timeout"},
            body=content,
            type="process",
        )

    rows = await sqlite_db.read(Process, tag=task_tag)
    row = rows[0] if rows else None

    if row is None:
        return await conclude_request(
            {"status": "failure", "error": "Process tree not found"},
            body=content,
            type="process",
        )

    return await conclude_request(
        {"status": "success", "tree": await _parse_tree(row.tree)},
        body=content,
        type="process",
    )
