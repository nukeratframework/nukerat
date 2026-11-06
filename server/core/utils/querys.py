import json
import random
import string
from infra.database.database import AgentsHistory, Queue, sqlite_db
from utils.validation import wait_nukescript_validation


def generate_tag(length: int = 6) -> str:
    # Builds a random tag
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


async def create_queue_line(
    host: str,
    qtype: str,
    input: str,
    parameters: str | dict,
    *,
    command: str = "",
    tag: str | None = None,
    is_completed: int = 0,
    is_ready: int = 1,
) -> str:
    # Stores a new queue line and waits for nukescript validation
    if isinstance(parameters, dict):
        parameters = json.dumps(parameters)

    tag = tag or generate_tag()

    await sqlite_db.write(Queue(
        tag=tag,
        host=host,
        type=qtype,
        command=command,
        input=input,
        parameters=parameters,
        is_completed=is_completed,
        is_ready=is_ready,
    ))
    if is_ready:
        await wait_nukescript_validation(tag)
    return tag


async def read_queue_line(tag: str):
    # Returns the queue line for the tag
    rows = await sqlite_db.read(Queue, tag=tag)
    return rows[0] if rows else None


async def delete_queue_line(tag: str) -> None:
    # Deletes the queue line for the tag
    await sqlite_db.delete(Queue, tag=tag)


async def create_agent_history_line(chat_id: str, role: str, content: str) -> None:
    # Stores one agent chat line in the DB
    await sqlite_db.write(AgentsHistory(chat_id=chat_id, role=role, content=content))
