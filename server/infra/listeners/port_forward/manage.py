import uuid
import json
import socket
import asyncio
import threading
import random
import string
import base64
from typing import Optional
from infra.database.database import sqlite_db
from infra.database.database import Listener as ListenerRow
from utils.querys import generate_tag
from infra.listeners.socks.queue_bridge import get_bridge
from infra.listeners.socks.manage import (
    ListenerNotFoundError,
    ListenerStartupError,
    PortAlreadyInUseError,
)
from infra.general.create_log import logger, write_log

class PortForwardManager:
    startup_timeout = 5.0
    stop_timeout = 10.0

    def __init__(self):
        # Class init, sets up the lock and the port forward map
        self.lock = threading.Lock()
        self.listeners: dict[str, dict] = {}

    async def setup(self) -> None:
        # Loads saved port forward listeners back from the database
        await self.sync_from_db()

    def pub(self, record: dict) -> dict:
        # Builds the public port forward record without internal runtime fields
        skip = ("loop", "server", "thread", "config_data", "sock")
        out = {k: v for k, v in record.items() if k not in skip}
        tag = record.get("tag") or record.get("session_id")
        out.pop("session_id", None)
        if tag:
            out["tag"] = tag
        return out

    def run_server(self, cfg: dict, sock: socket.socket, ready: threading.Event, state: dict) -> None:
        # Runs the port forward accept loop inside its own thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        bridge = get_bridge()

        async def relay(reader, writer):
            # Relays bytes between the local client and the remote beacon
            tag = (cfg.get("hostTag") or "").strip()
            fh = (cfg.get("forwardHost") or "").strip()
            fp = int(cfg.get("forwardPort") or 0)
            cid = "".join(random.choices(string.ascii_letters + string.digits, k=9))
            q = "port_forwarding"
            try:
                ok = await bridge.call(tag, "connect", {"host": fh, "port": fp, "conn_id": cid}, q)
                if not ok.get("ok"):
                    return
                async def up():
                    # Reads from the local client and writes those bytes to the beacon
                    while True:
                        data = await reader.read(65536)
                        if not data:
                            break
                        w = await bridge.call(tag, "write", {"conn_id": cid, "data": base64.b64encode(data).decode()}, q)
                        if not w.get("ok"):
                            break
                async def down():
                    # Reads from the beacon and writes those bytes to the local client
                    while True:
                        r = await bridge.call(tag, "read", {"conn_id": cid, "max": 65536}, q)
                        if not r.get("ok"):
                            break
                        chunk = base64.b64decode(r.get("data") or "")
                        if not chunk:
                            break
                        writer.write(chunk)
                        await writer.drain()
                await asyncio.gather(up(), down())
            finally:
                await bridge.call(tag, "close", {"conn_id": cid}, q)
                writer.close()

        async def main():
            # Starts the port forward server and serves until the loop stops
            srv = await asyncio.start_server(relay, sock=sock)
            state["loop"] = loop
            state["server"] = srv
            ready.set()
            async with srv:
                await srv.serve_forever()

        try:
            loop.run_until_complete(main())
        except RuntimeError as exc:
            if "Event loop stopped before Future completed" in str(exc):
                return
            write_log(logger, "error", f"Unhandled exception | port_forward | {exc}")
            state["error"] = exc
            ready.set()
        except Exception as exc:
            write_log(logger, "error", f"Unhandled exception | port_forward | {exc}")
            state["error"] = exc
            ready.set()

    async def sync_from_db(self) -> None:
        # Restores port forward listeners saved in the database
        rows = await sqlite_db.read(ListenerRow)
        restoring = False
        for row in rows:
            if row.type != "port_forwarding":
                continue
            if not restoring:
                restoring = True
            try:
                cfg = json.loads(row.config)
                await self.start_listener(
                    session_id=row.tag,
                    port=int(cfg.get("portToOpen") or cfg.get("port")),
                    config_data=cfg,
                )
            except Exception as exc:
                write_log(logger, "error", f"Unhandled exception | port_forward sync {row.tag} | {exc}")

    async def start_listener(self, port: int, config_data: Optional[dict] = None, session_id: Optional[str] = None) -> str:
        # Binds the local port and starts the port forward listener thread
        config = config_data or {}
        with self.lock:
            for r in self.listeners.values():
                if r["port"] == port:
                    raise PortAlreadyInUseError(f"Port {port} is already in use")
        tag = (config.get("hostTag") or "").strip()
        if not tag:
            raise ListenerStartupError("hostTag required")
        if not (config.get("forwardHost") or "").strip():
            raise ListenerStartupError("forwardHost required")
        host = (config.get("host") or "0.0.0.0").strip() or "0.0.0.0"
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            sock.close()
            raise PortAlreadyInUseError(f"Port {port} on '{host}' is already in use: {exc}") from exc

        ready = threading.Event()
        state: dict = {}
        thread = threading.Thread(
            target=self.run_server,
            args=(config, sock, ready, state),
            daemon=True,
            name=f"port-forward-{port}",
        )
        thread.start()
        ok = await asyncio.to_thread(ready.wait, self.startup_timeout)
        if not ok:
            sock.close()
            raise ListenerStartupError(f"Listener on port {port} did not start within {self.startup_timeout}s")
        if state.get("error"):
            exc = state["error"]
            sock.close()
            raise exc if isinstance(exc, PortAlreadyInUseError) else ListenerStartupError(f"Listener failed to start: {exc}") from exc
        if not await asyncio.to_thread(self.port_open, port, 1.0):
            sock.close()
            raise ListenerStartupError(f"Listener on port {port} is not accepting connections")
        session_id = session_id or generate_tag()
        with self.lock:
            self.listeners[session_id] = {
                "session_id": session_id,
                "host": "0.0.0.0",
                "port": port,
                "networkType": "port_forwarding",
                "protocol": config.get("protocol", "tcp"),
                "hostTag": tag,
                "forwardHost": config.get("forwardHost", ""),
                "forwardPort": config.get("forwardPort", ""),
                "targetPort": port,
                "config_data": config,
                "sock": sock,
                "loop": state.get("loop"),
                "server": state.get("server"),
                "thread": thread,
            }
        return session_id

    def port_open(self, port: int, timeout: float) -> bool:
        # Checks whether the local port is accepting connections
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=timeout):
                return True
        except OSError:
            return False

    def all(self) -> list[dict]:
        # Returns the public view of every running port forward listener
        with self.lock:
            return [self.pub(r) for r in self.listeners.values()]

    def get(self, session_id: str) -> Optional[dict]:
        # Returns one public port forward listener by session id
        with self.lock:
            r = self.listeners.get(session_id)
            return self.pub(r) if r else None

    async def create(self, port: int, config_data: Optional[dict] = None) -> str:
        # Creates a port forward listener and stores the row in the database
        config = {**(config_data or {}), "host": "0.0.0.0", "portToOpen": port, "networkType": "port_forwarding"}
        session_id = await self.start_listener(port=port, config_data=config)
        await sqlite_db.write(ListenerRow(
            tag=session_id,
            type="port_forwarding",
            protocol=config.get("protocol", "tcp"),
            config=json.dumps(config),
        ))
        return session_id

    async def stop(self, session_id: str) -> None:
        # Stops a port forward listener and deletes its row from the database
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            loop = record.get("loop")
            server = record.get("server")
            thread = record.get("thread")
        if loop and server:
            loop.call_soon_threadsafe(loop.stop)
            try:
                server.close()
            except Exception as exc:
                write_log(logger, "error", f"Unhandled exception | port_forward stop | {exc}")
        if thread:
            thread.join(timeout=self.stop_timeout)
        with self.lock:
            self.listeners.pop(session_id, None)
        await sqlite_db.delete(ListenerRow, tag=session_id)

    async def restart(self, session_id: str) -> str:
        # Stops a port forward listener and creates it again with the same config
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            port = record["port"]
            config = dict(record.get("config_data") or {})
        await self.stop(session_id)
        return await self.create(port=port, config_data=config)


port_forward_listener = PortForwardManager()
