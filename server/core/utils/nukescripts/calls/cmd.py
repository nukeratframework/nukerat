import asyncio
import json

from fastapi.responses import JSONResponse
from logic.terminal.core import main_session_commands

main_loop = None


def parse_cmd_response(response):
    # Reads the command result from the response
    if isinstance(response, JSONResponse):
        data = json.loads(response.body.decode())
    elif isinstance(response, dict):
        data = response
    else:
        return "Invalid command response"

    status = data.get("status")
    message = data.get("message", "")
    if status == "success":
        return message
    if message:
        return message
    return "Command failed"


async def send_cmd(host_tag, command):
    # Sends a command to the host and returns the output
    body = {"host_tag": host_tag, "command": str(command), "id": "nukescript"}
    response = await main_session_commands(body)
    return parse_cmd_response(response)


def dispatch_cmd(host_tag, command):
    # Runs the command call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_cmd(host_tag, command),
        main_loop,
    )
    return future.result()
