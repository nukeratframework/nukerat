import uuid
import json
import socket
import asyncio
import threading
from typing import Optional
from infra.database.database import sqlite_db
from infra.database.database import Listener as ListenerRow
from utils.querys import generate_tag
from infra.listeners.socks.streams import BeaconRemote
from infra.general.create_log import logger, write_log

class ListenerError(Exception): pass
class PortAlreadyInUseError(ListenerError): pass
class ListenerNotFoundError(ListenerError): pass
class ListenerStartupError(ListenerError): pass
class ListenerStopError(ListenerError): pass

class SocksListenerManager:
    startup_timeout = 5.0
    stop_timeout = 10.0

    def __init__(self):
        # Class init, sets up the lock and the listener map
        self.lock = threading.Lock()
        self.listeners: dict[str, dict] = {}

    async def setup(self) -> None:
        # Loads saved socks listeners back from the database
        await self.sync_from_db()

    def pub(self, record: dict) -> dict:
        # Builds the public listener record without internal runtime fields
        skip = ("loop", "server", "thread", "config_data")
        out = {k: v for k, v in record.items() if k not in skip}
        tag = record.get("tag") or record.get("session_id")
        out.pop("session_id", None)
        if tag:
            out["tag"] = tag
        return out

    def listen_uri(self, port: int, config: dict) -> str:
        # Builds the socks listen uri and appends auth when both are set
        user = (config.get("authUser") or "").strip()
        passwd = (config.get("authPass") or "").strip()
        base = f"socks5://0.0.0.0:{port}/"
        if user and passwd:
            return f"{base}#{user}:{passwd}"
        return base

    def run_pproxy(self, uri: str, ready: threading.Event, state: dict) -> None:
        # Runs the socks proxy server loop until it is stopped
        try:
            from pproxy.server import proxies_by_uri, DUMMY
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            option = proxies_by_uri(uri)
            args = {
                "ruport": False,
                "debug": 0,
                "verbose": DUMMY,
                "block": None,
                "salgorithm": "fa",
                "authtime": 0,
                "rserver": [],
            }
            host_tag = (state.get("host_tag") or "").strip()
            if host_tag:
                args["rserver"] = [BeaconRemote(host_tag)]
            server = loop.run_until_complete(option.start_server(args))
            state["loop"] = loop
            state["server"] = server
            ready.set()
            loop.run_forever()
        except Exception as exc:
            write_log(logger, "error", f"Unhandled exception | socks uri={uri} | {exc}")
            state["error"] = exc
            ready.set()

    async def sync_from_db(self) -> None:
        # Restores socks and proxychains listeners saved in the database
        rows = await sqlite_db.read(ListenerRow)
        restoring = False
        for row in rows:
            if row.type not in ("socks", "proxychains"):
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
                write_log(logger, "error", f"Unhandled exception | socks sync {row.tag} | {exc}")

    async def start_listener(
        self,
        port: int,
        config_data: Optional[dict] = None,
        session_id: Optional[str] = None,
    ) -> str:
        # Starts a socks listener thread and keeps the session in memory
        config = config_data or {}
        with self.lock:
            for r in self.listeners.values():
                if r["port"] == port:
                    raise PortAlreadyInUseError(f"Port {port} is already in use")

        uri = self.listen_uri(port, config)
        host_tag = (config.get("hostTag") or config.get("host_tag") or "").strip()
        ready = threading.Event()
        state: dict = {"host_tag": host_tag}
        thread = threading.Thread(target=self.run_pproxy, args=(uri, ready, state), daemon=True, name=f"socks-{port}")
        thread.start()

        ok = await asyncio.to_thread(ready.wait, self.startup_timeout)
        if not ok:
            raise ListenerStartupError(f"Listener on port {port} did not start within {self.startup_timeout}s")

        if state.get("error"):
            raise ListenerStartupError(str(state["error"]))

        if not await asyncio.to_thread(self.port_open, port, 1.0):
            raise ListenerStartupError(f"Listener on port {port} is not accepting connections")

        session_id = session_id or generate_tag()
        with self.lock:
            self.listeners[session_id] = {
                "session_id": session_id,
                "host": "0.0.0.0",
                "port": port,
                "networkType": "socks",
                "protocol": "socks5",
                "authUser": config.get("authUser", ""),
                "authPass": config.get("authPass", ""),
                "hostTag": host_tag,
                "targetPort": port,
                "config_data": config,
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
        # Returns the public view of every running socks listener
        with self.lock:
            return [self.pub(r) for r in self.listeners.values()]

    def get(self, session_id: str) -> Optional[dict]:
        # Returns one public socks listener by session id
        with self.lock:
            r = self.listeners.get(session_id)
            return self.pub(r) if r else None

    async def create(self, port: int, config_data: Optional[dict] = None) -> str:
        # Creates a socks listener and stores the row in the database
        config = {**(config_data or {}), "host": "0.0.0.0", "portToOpen": port, "networkType": "socks"}
        host_tag = (config.get("hostTag") or config.get("host_tag") or "").strip()
        if host_tag:
            config["hostTag"] = host_tag
        session_id = await self.start_listener(port=port, config_data=config)
        await sqlite_db.write(ListenerRow(
            tag=session_id,
            type="socks",
            protocol="socks5",
            config=json.dumps(config),
        ))
        return session_id

    async def stop(self, session_id: str) -> None:
        # Stops a socks listener and deletes its row from the database
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
                write_log(logger, "error", f"Unhandled exception | socks stop | {exc}")
        if thread:
            thread.join(timeout=self.stop_timeout)

        with self.lock:
            self.listeners.pop(session_id, None)
        await sqlite_db.delete(ListenerRow, tag=session_id)

    async def restart(self, session_id: str) -> str:
        # Stops a socks listener and creates it again with the same config
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            port = record["port"]
            config = dict(record.get("config_data") or {})

        await self.stop(session_id)
        return await self.create(port=port, config_data=config)


socks_listener = SocksListenerManager()
