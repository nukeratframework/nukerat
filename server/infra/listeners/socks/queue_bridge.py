import json
import asyncio
from infra.database.database import sqlite_db
from infra.general.create_log import logger, write_log
from utils.querys import create_queue_line

bridge = None

class QueueBridge:
    def __init__(self):
        # Class init, stores the main event loop reference
        self.main_loop = None

    async def dispatch(self, host_tag: str, op: str, params: dict, qtype: str = "socks") -> dict:
        # Sends a queue command and waits for the beacon response
        cmd_tag = await create_queue_line(
            host=host_tag,
            qtype=qtype,
            input=op,
            parameters=params,
        )

        raw = await sqlite_db.wait_response(host_tag, cmd_tag, None)
        if not raw or raw.startswith("timeout"):
            return {"ok": False, "error": raw or "timeout"}
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            write_log(logger, "error", f"Unhandled exception | socks/queue_bridge | {e}")
            return {"ok": False, "error": raw}

    async def call(self, host_tag: str, op: str, params: dict, qtype: str = "socks") -> dict:
        # Routes the queue call onto the main loop when needed
        if not self.main_loop:
            return await self.dispatch(host_tag, op, params, qtype)
        if asyncio.get_running_loop() is self.main_loop:
            return await self.dispatch(host_tag, op, params, qtype)
        future = asyncio.run_coroutine_threadsafe(self.dispatch(host_tag, op, params, qtype), self.main_loop)
        return await asyncio.wrap_future(future)


def get_bridge() -> QueueBridge:
    # Returns the shared queue bridge, creating it on first use
    global bridge
    if bridge is None:
        bridge = QueueBridge()
    return bridge
