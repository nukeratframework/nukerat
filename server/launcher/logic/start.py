import os
import sys
from pathlib import Path
import uvicorn
from launcher.utils.config import config
from launcher.utils.create_log import log_label, setup_logging, log_config


def setup_init():
    # Adds the server paths to sys.path and clears the files in tmp
    server_root = Path(__file__).resolve().parents[2]
    for path in (server_root, server_root / "core"):
        entry = str(path)
        if entry not in sys.path:
            sys.path.insert(0, entry)

    tmp_dir = server_root / "infra" / "tmp"
    if tmp_dir.is_dir():
        for path in tmp_dir.iterdir():
            if path.is_file():
                path.unlink(missing_ok=True)


def main_start():
    # Main function that starts the server with uvicorn
    setup_init()
    setup_logging()
    log_label.set("launcher")
    log_label.set("server")
    try:
        srv = config["config"]
        workers = srv.get("workers", 1)
        use_reload = bool(srv.get("reload"))
        if use_reload and workers > 1:
            workers = 1
        uvicorn_kwargs = {
            "host": srv["host"],
            "port": srv["port"],
            "log_config": log_config,
            "access_log": True,
            "timeout_graceful_shutdown": 0,
            "workers": workers,
            "loop": srv.get("loop", "auto"),
            "http": srv.get("http", "auto"),
            "backlog": srv.get("backlog", 2048),
            "timeout_keep_alive": srv.get("timeout_keep_alive", 75),
            "timeout_worker_healthcheck": srv.get("timeout_worker_healthcheck", 5),
            "proxy_headers": srv.get("proxy_headers", True),
            "forwarded_allow_ips": srv.get("forwarded_allow_ips", "127.0.0.1"),
        }
        if use_reload:
            uvicorn_kwargs["reload"] = True
        if srv.get("limit_concurrency") is not None:
            uvicorn_kwargs["limit_concurrency"] = srv["limit_concurrency"]
        if srv.get("limit_max_requests") is not None:
            uvicorn_kwargs["limit_max_requests"] = srv["limit_max_requests"]
        cert_path = str(srv.get("certfile") or "").strip()
        key_path = str(srv.get("keyfile") or "").strip()
        tls_skip = {"", "none", "false", "null", "unset"}
        if (
            cert_path.lower() not in tls_skip
            and key_path.lower() not in tls_skip
            and os.path.isfile(cert_path)
            and os.path.isfile(key_path)
            and os.access(cert_path, os.R_OK)
            and os.access(key_path, os.R_OK)
        ):
            uvicorn_kwargs["ssl_certfile"] = cert_path
            uvicorn_kwargs["ssl_keyfile"] = key_path
        cfg = uvicorn.Config("core.server:app", **uvicorn_kwargs)
        server = uvicorn.Server(cfg)
        # Close all the things
        server.handle_exit = lambda sig, frame: os._exit(0)
        server.run()
    except KeyboardInterrupt:
        os._exit(0)
