import os
import uuid
import json
import socket
import asyncio
import threading
import tempfile
import uvicorn
from typing import Optional
from fastapi import FastAPI
from infra.database.database import sqlite_db
from infra.database.database import Listener as ListenerRow
from infra.database.listener_utils import listener_utils
from utils.querys import generate_tag
from infra.listeners.http.routes.commands import make_router
from infra.listeners.http.utils.create_log import log_config, logger, setup_logging
from infra.general.create_log import logger as app_logger, write_log
from infra.listeners.http.utils.communication import prepare_listener_config
from infra.listeners.profile import apply_profile_middleware

class ListenerError(Exception): pass
class PortAlreadyInUseError(ListenerError): pass
class ListenerNotFoundError(ListenerError): pass
class ListenerAlreadyExistsError(ListenerError): pass
class ListenerStartupError(ListenerError): pass
class ListenerStopError(ListenerError): pass


def resolve_ssl_files(cert: dict) -> tuple[Optional[str], Optional[str], list[str]]:
    # Resolves the cert and the key into file paths
    tmp = []
    def path(value):
        # Turns a cert value into a file path
        if not value or not str(value).strip():
            return None
        text = str(value).strip()
        if "-----BEGIN" in text:
            fd, p = tempfile.mkstemp(suffix=".pem")
            with os.fdopen(fd, "w", encoding="utf-8") as h:
                h.write(text)
            tmp.append(p)
            return p
        return text
    return path(cert.get("certPem") or cert.get("path")), path(cert.get("keyPem") or cert.get("pem")), tmp


class ManagedServer(uvicorn.Server):
    def __init__(self, config):
        # Class init, stores the ready event and the error
        super().__init__(config)
        self.ready = threading.Event()
        self.error: Optional[BaseException] = None

    async def startup(self, sockets=None):
        # Starts uvicorn and signals when the server is ready
        try:
            await super().startup(sockets=sockets)
        except BaseException as exc:
            write_log(app_logger, "error", f"Unhandled exception | listener uvicorn startup | {exc}")
            self.error = exc
            self.ready.set()
            raise
        if self.should_exit:
            self.error = PortAlreadyInUseError(f"Port {self.config.port} on '{self.config.host}' already in use")
        self.ready.set()


class HttpListenerManager:
    startup_timeout = 5.0
    stop_timeout = 10.0

    def __init__(self):
        # Class init, stores the lock, the listeners and the loop
        self.lock = threading.Lock()
        self.listeners: dict[str, dict] = {}
        self.loop = None

    async def setup(self) -> None:
        # Starts the loop, logging, the DB and restores listeners
        self.loop = asyncio.get_running_loop()
        setup_logging()
        await sqlite_db.start()
        await self.sync_from_db()

    def pub(self, record: dict) -> dict:
        # Builds the public record without internal fields
        cfg = record.get("config_data") or {}
        out = {}
        for k, v in record.items():
            if k in ("thread", "server", "ssl_tmp", "config_data", "sock"):
                continue
            out[k] = v
        if "listenerType" in cfg:
            out["listenerType"] = cfg["listenerType"]
        if "channelPayload" in cfg:
            out["channelPayload"] = cfg["channelPayload"]
        if "endpointPath" in cfg:
            out["endpointPath"] = cfg["endpointPath"]
        if "implantBodyType" in cfg or "beaconBodyType" in cfg:
            out["implantBodyType"] = cfg.get("implantBodyType") or cfg.get("beaconBodyType")
        if "implantBody" in cfg or "beaconBody" in cfg:
            out["implantBody"] = cfg.get("implantBody") or cfg.get("beaconBody")
        if "listenerResponse" in cfg:
            out["listenerResponse"] = cfg["listenerResponse"]
        if "responseHeaders" in cfg:
            out["responseHeaders"] = cfg["responseHeaders"]
        if "bind_interface" in cfg:
            out["bind_interface"] = cfg["bind_interface"]
        if "profile" in cfg:
            out["profile"] = cfg["profile"]
        if "portToOpen" in cfg:
            out["portToOpen"] = cfg["portToOpen"]
        tag = record.get("tag") or record.get("session_id")
        out.pop("session_id", None)
        if tag:
            out["tag"] = tag
        return out

    async def sync_from_db(self) -> None:
        # Restores the http listeners stored in the DB
        rows = await sqlite_db.read(ListenerRow)
        restoring = False
        for row in rows:
            if row.type in ("file_server", "socks", "proxychains", "port_forwarding"):
                continue
            if not restoring:
                restoring = True
            try:
                cfg = json.loads(row.config)
                if row.cert_pem and row.key_pem:
                    cfg.setdefault("cert", {})
                    cfg["cert"].update({
                        "enabled": True,
                        "certPem": row.cert_pem,
                        "keyPem": row.key_pem,
                    })
                host = cfg["host"]
                port = int(cfg.get("portToOpen") or cfg.get("port"))
                channel_payload = cfg.get("channelPayload", "http")
                cert = cfg.get("cert") or {}
                ssl = channel_payload == "https" and cert.get("enabled", False)
                await self.start_listener(
                    session_id=row.tag,
                    name=cfg.get("name", row.tag),
                    host=host,
                    port=port,
                    ssl=ssl,
                    config_data=cfg,
                )
            except Exception as exc:
                print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to start http listener {row.tag} | {exc}")
        

    async def start_listener(self, name: str, host: str, port: int, ssl: bool = False,
                        certfile: Optional[str] = None, keyfile: Optional[str] = None,
                        config_data: Optional[dict] = None,
                        session_id: Optional[str] = None) -> str:
        # Starts one http listener on the given host and port
        with self.lock:
            for r in self.listeners.values():
                if r["name"] == name:
                    raise ListenerAlreadyExistsError("Listener named already exists")
                if r["host"] == host and r["port"] == port:
                    raise PortAlreadyInUseError(f"Port {port} on '{host}' is already in use")

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            sock.close()
            raise PortAlreadyInUseError(f"Port {port} on '{host}' is already in use: {exc}") from exc

        ssl_tmp = []
        if ssl:
            cert = (config_data or {}).get("cert") or {}
            if cert:
                certfile, keyfile, ssl_tmp = resolve_ssl_files(cert)
            if not certfile:
                sock.close()
                raise ListenerStartupError("SSL enabled but no certfile provided")

        ssl_kwargs = {}
        if ssl:
            ssl_kwargs["ssl_certfile"] = certfile
            if keyfile:
                ssl_kwargs["ssl_keyfile"] = keyfile

        app = FastAPI(title=name, docs_url=None, redoc_url=None, openapi_url=None)

        cfg = prepare_listener_config(config_data or {})
        app.middleware("http")(apply_profile_middleware(cfg))

        app.state.db = listener_utils
        app.include_router(make_router(cfg))

        config = uvicorn.Config(app=app, host=host, port=port, log_level="info", access_log=False, log_config=log_config, server_header=False, **ssl_kwargs)
        server = ManagedServer(config)
        session_id = session_id or generate_tag()

        def run():
            # Runs the uvicorn loop for this listener
            from launcher.utils.create_log import log_label
            log_label.set("listeners")
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(server.serve(sockets=[sock]))
            except BaseException as exc:
                write_log(app_logger, "error", f"Unhandled exception | listener died {session_id} | {exc}")
            finally:
                loop.close()
                for p in ssl_tmp:
                    try:
                        os.remove(p)
                    except OSError:
                        pass
                with self.lock:
                    self.listeners.pop(session_id, None)
                if self.loop and self.loop.is_running():
                    asyncio.run_coroutine_threadsafe(sqlite_db.delete(ListenerRow, tag=session_id), self.loop)

        thread = threading.Thread(target=run, daemon=True, name=f"listener-{session_id}")
        thread.start()

        if not await asyncio.to_thread(server.ready.wait, self.startup_timeout):
            server.should_exit = True
            thread.join(timeout=2)
            sock.close()
            for p in ssl_tmp:
                try:
                    os.remove(p)
                except OSError:
                    pass
            raise ListenerStartupError(f"Listener on {host}:{port} did not start within {self.startup_timeout}s")

        if server.error:
            exc = server.error
            sock.close()
            for p in ssl_tmp:
                try:
                    os.remove(p)
                except OSError:
                    pass
            raise exc if isinstance(exc, PortAlreadyInUseError) else ListenerStartupError(f"Listener failed to start: {exc}") from exc

        with self.lock:
            self.listeners[session_id] = {
                "session_id": session_id, "name": name, "host": host, "port": port,
                "ssl": ssl, "certfile": certfile, "keyfile": keyfile,
                "config_data": config_data, "ssl_tmp": ssl_tmp, "sock": sock,
                "thread": thread, "server": server,
            }

        scheme = "https" if ssl else "http"
        print(f"[ \x1b[38;2;0;238;0mOK\x1b[0m ] Started http listener {name} ({scheme}://{host}:{port})")
        return session_id

    def all(self) -> list[dict]:
        # Returns every running http listener
        with self.lock:
            return [{**self.pub(r), "protocol": "https" if r.get("ssl") else "http"} for r in self.listeners.values()]

    def get(self, session_id: str) -> Optional[dict]:
        # Returns one listener by its tag
        with self.lock:
            r = self.listeners.get(session_id)
            return self.pub(r) if r else None

    async def create(self, host: str, port: int, name: str = "", ssl: bool = False,
               certfile: Optional[str] = None, keyfile: Optional[str] = None,
               config_data: Optional[dict] = None, session_id: Optional[str] = None,
               cert_pem: Optional[str] = None, key_pem: Optional[str] = None) -> str:
        # Creates the listener and stores the row in the DB
        if config_data:
            cert = config_data.get("cert") or {}
            ssl = config_data.get("channelPayload", "http") == "https" and cert.get("enabled", False)
        if not name:
            name = str(uuid.uuid4())
        sid = await self.start_listener(name=name, host=host, port=port, ssl=ssl,
                                          certfile=certfile, keyfile=keyfile, config_data=config_data,
                                          session_id=session_id)
        try:
            config_json = json.dumps(config_data or {"host": host, "port": port, "ssl": ssl})
            protocol = "https" if ssl else "http"
            await sqlite_db.write(ListenerRow(
                tag=sid, type="http", protocol=protocol, config=config_json,
                cert_pem=cert_pem, key_pem=key_pem,
            ))
        except Exception as e:
            write_log(app_logger, "error", f"Unhandled exception | listener db write {sid} | {e}")
            try:
                await self.stop(sid)
            except Exception as stop_exc:
                write_log(app_logger, "error", f"Unhandled exception | listener rollback stop {sid} | {stop_exc}")
            raise
        return sid

    async def stop(self, session_id: str) -> None:
        # Stops the listener and removes the row from the DB
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            server, thread = record["server"], record["thread"]
            ssl_tmp = record.get("ssl_tmp") or []

        server.should_exit = True
        thread.join(timeout=self.stop_timeout)
        if thread.is_alive():
            raise ListenerStopError(f"Listener '{session_id}' did not stop within {self.stop_timeout}s")

        for p in ssl_tmp:
            try:
                os.remove(p)
            except OSError:
                pass

        with self.lock:
            self.listeners.pop(session_id, None)
        await sqlite_db.delete(ListenerRow, tag=session_id)

    async def restart(self, session_id: str, **overrides) -> str:
        # Stops the listener and starts it again
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            params = {k: record[k] for k in ("name", "host", "port", "ssl", "certfile", "keyfile", "config_data") if k in record}

        await self.stop(session_id)
        params.update(overrides)
        return await self.create(session_id=session_id, **params)


http_listener = HttpListenerManager()
