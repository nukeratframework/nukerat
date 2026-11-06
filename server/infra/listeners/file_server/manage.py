import os
import uuid
import json
import socket
import shutil
import asyncio
import threading
import uvicorn
from typing import Optional
from infra.database.database import sqlite_db
from infra.database.database import Listener as ListenerRow
from utils.querys import generate_tag
from infra.listeners.file_server.routes.commands import content_root, make_app
from infra.listeners.file_server.utils.create_log import setup_logging
from infra.listeners.http.manage import (
    ListenerAlreadyExistsError,
    ListenerNotFoundError,
    ListenerStartupError,
    ListenerStopError,
    PortAlreadyInUseError,
    ManagedServer,
    resolve_ssl_files,
)
from infra.listeners.http.utils.create_log import log_config
from infra.general.create_log import logger, write_log

class FileServerListenerManager:
    startup_timeout = 5.0
    stop_timeout = 10.0

    def __init__(self):
        # Class init, stores the lock and the listeners
        self.lock = threading.Lock()
        self.listeners: dict[str, dict] = {}

    async def setup(self) -> None:
        # Starts logging, restores listeners and removes unused folders
        setup_logging()
        await self.sync_from_db()
        if os.path.isdir(content_root):
            with self.lock:
                active = {os.path.normpath(r["contentDir"]) for r in self.listeners.values() if r.get("contentDir")}
            for name in os.listdir(content_root):
                path = os.path.normpath(os.path.join(content_root, name))
                if os.path.isdir(path) and path not in active:
                    shutil.rmtree(path)

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
        if "endpointPath" in cfg:
            out["endpointPath"] = cfg["endpointPath"]
        if "implantBodyType" in cfg or "beaconBodyType" in cfg:
            out["implantBodyType"] = cfg.get("implantBodyType") or cfg.get("beaconBodyType")
        if "implantBody" in cfg or "beaconBody" in cfg:
            out["implantBody"] = cfg.get("implantBody") or cfg.get("beaconBody")
        if "responseHeaders" in cfg:
            out["responseHeaders"] = cfg["responseHeaders"]
        if "portToOpen" in cfg:
            out["portToOpen"] = cfg["portToOpen"]
        tag = record.get("tag") or record.get("session_id")
        out.pop("session_id", None)
        if tag:
            out["tag"] = tag
        return out

    async def sync_from_db(self) -> None:
        # Restores the file server listeners stored in the DB
        rows = await sqlite_db.read(ListenerRow)
        restoring = False
        for row in rows:
            if row.type != "file_server":
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
                cert = cfg.get("cert") or {}
                ssl = bool(cfg.get("ssl", cert.get("enabled", False)))
                await self.start_listener(
                    session_id=row.tag,
                    name=cfg.get("name", row.tag),
                    host=cfg["host"],
                    port=int(cfg.get("portToOpen") or cfg.get("port")),
                    ssl=ssl,
                    config_data=cfg,
                )
            except Exception as e:
                print(f"\n[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to start file server listener {row.tag}")
                print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] {e}")
                write_log(logger, "error", f"Unhandled exception | file_server sync {row.tag} | {e}")

    async def start_listener(self, name: str, host: str, port: int, ssl: bool = False,
                        certfile: Optional[str] = None, keyfile: Optional[str] = None,
                        config_data: Optional[dict] = None,
                        session_id: Optional[str] = None) -> str:
        # Starts one file server listener on the given host and port
        with self.lock:
            if any(r["name"] == name for r in self.listeners.values()):
                raise ListenerAlreadyExistsError("Listener named already exists")

        config = config_data or {}
        content_dir = config.get("contentDir")
        if not content_dir:
            folder = os.path.basename(str(name or "").replace("\\", "/")) or str(uuid.uuid4())
            content_dir = os.path.join(content_root, folder)
            config["contentDir"] = content_dir
        config["name"] = name
        os.makedirs(content_dir, exist_ok=True)

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError as exc:
            sock.close()
            raise PortAlreadyInUseError(f"Port {port} on '{host}' is already in use: {exc}") from exc

        ssl_tmp = []
        if ssl:
            cert = config.get("cert") or {}
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

        app = make_app(content_dir, config)
        uvicorn_config = uvicorn.Config(
            app=app, host=host, port=port, log_level="info",
            access_log=False, log_config=log_config, server_header=False, **ssl_kwargs,
        )
        server = ManagedServer(uvicorn_config)
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
                write_log(logger, "error", f"Unhandled exception | file_server died {session_id} | {exc}")
            finally:
                loop.close()
                for p in ssl_tmp:
                    try:
                        os.remove(p)
                    except OSError:
                        pass

        thread = threading.Thread(target=run, daemon=True, name=f"file-server-{session_id}")
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
                "listenerType": "file_server", "contentDir": content_dir,
                "config_data": config, "ssl_tmp": ssl_tmp, "sock": sock,
                "thread": thread, "server": server,
            }

        scheme = "https" if ssl else "file"
        print(f"[ \x1b[38;2;0;238;0mOK\x1b[0m ] Started file server listener {name} ({scheme}://{host}:{port})")
        return session_id

    def all(self) -> list[dict]:
        # Returns every running file server listener
        with self.lock:
            return [{**self.pub(r), "protocol": "https" if r.get("ssl") else "file"} for r in self.listeners.values()]

    def get(self, session_id: str) -> Optional[dict]:
        # Returns one listener by its tag
        with self.lock:
            r = self.listeners.get(session_id)
            return self.pub(r) if r else None

    async def create(self, host: str, port: int, name: str = "", config_data: Optional[dict] = None,
               cert_pem: Optional[str] = None, key_pem: Optional[str] = None) -> str:
        # Creates the listener and stores the row in the DB
        ssl = bool((config_data or {}).get("ssl", False))
        if not ssl:
            cert = (config_data or {}).get("cert") or {}
            ssl = cert.get("enabled", False)
        if not name:
            name = str(uuid.uuid4())
        session_id = await self.start_listener(
            name=name, host=host, port=port, ssl=ssl, config_data=config_data,
        )
        config_json = json.dumps(config_data or {"host": host, "port": port, "listenerType": "file_server"})
        protocol = "https" if ssl else "file"
        await sqlite_db.write(ListenerRow(
            tag=session_id, type="file_server", protocol=protocol, config=config_json,
            cert_pem=cert_pem, key_pem=key_pem,
        ))
        return session_id

    async def stop(self, session_id: str, keep_folder: bool = False) -> None:
        # Stops the listener and removes the row from the DB
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            server, thread = record["server"], record["thread"]
            content_dir = record.get("contentDir")
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

        if not keep_folder and content_dir and os.path.isdir(content_dir):
            shutil.rmtree(content_dir)

    async def restart(self, session_id: str, **overrides) -> str:
        # Stops the listener and starts it again
        with self.lock:
            record = self.listeners.get(session_id)
            if not record:
                raise ListenerNotFoundError(f"Listener '{session_id}' not found")
            params = {k: record[k] for k in ("name", "host", "port", "ssl", "certfile", "keyfile", "config_data", "contentDir") if k in record}

        await self.stop(session_id, keep_folder=True)
        params.update(overrides)
        config = {**params.get("config_data", {}), "listenerType": "file_server", "portToOpen": params["port"], "contentDir": params.get("contentDir")}
        cert = config.get("cert") or {}
        return await self.create(
            host=params["host"],
            port=params["port"],
            name=params.get("name", ""),
            config_data=config,
            cert_pem=cert.get("certPem"),
            key_pem=cert.get("keyPem"),
        )


file_server_listener = FileServerListenerManager()
