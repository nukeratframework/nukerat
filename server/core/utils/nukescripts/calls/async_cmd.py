import asyncio
from logic.terminal.core import main_session_commands

main_loop = None

async def send_async_cmd(host_tag, command):
    # Sends a background command to the host
    cmd = str(command)
    if not cmd.startswith("&"):
        cmd = "&" + cmd
    body = {"host_tag": host_tag, "command": cmd, "id": "nukescript"}
    await main_session_commands(body)


def dispatch_async_cmd(host_tag, command):
    # Runs the background command on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_async_cmd(host_tag, command),
        main_loop,
    )
    future.result()
