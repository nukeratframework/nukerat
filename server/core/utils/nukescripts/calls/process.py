import asyncio
import json

from fastapi.responses import JSONResponse
from logic.process.core import main_process

main_loop = None


def parse_process_response(response):
    # Reads the process result from the response
    if isinstance(response, JSONResponse):
        return json.loads(response.body.decode())
    if isinstance(response, dict):
        return response
    return {"status": "failure", "error": "Invalid process response"}


async def send_process(host_tag):
    # Lists the processes of the host
    body = {"host": host_tag}
    response = await main_process(body)
    return parse_process_response(response)


def dispatch_process(host_tag):
    # Runs the process call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_process(host_tag),
        main_loop,
    )
    return future.result()
