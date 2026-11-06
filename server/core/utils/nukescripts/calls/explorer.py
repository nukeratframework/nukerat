import asyncio
import json

from fastapi.responses import JSONResponse
from logic.explorer.core import main_explorer

main_loop = None


def parse_explorer_response(response):
    # Reads the explorer result from the response
    if isinstance(response, JSONResponse):
        return json.loads(response.body.decode())
    if isinstance(response, dict):
        return response
    return {"status": "failure", "error": "Invalid explorer response"}


async def send_explorer(host_tag, path):
    # Lists the folder path on the host
    body = {"host": host_tag, "path": path, "autoRefresh": True}
    response = await main_explorer(body)
    return parse_explorer_response(response)


def dispatch_explorer(host_tag, path):
    # Runs the explorer call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_explorer(host_tag, path),
        main_loop,
    )
    return future.result()
