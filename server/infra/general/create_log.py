import logging
import sys
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import Request
from fastapi.responses import ORJSONResponse
logger = logging.getLogger("app")
listener_logger = logging.getLogger("listener")
log_path = Path(__file__).resolve().parent.parent.parent / "logs" / "server.log"
listeners_log_path = log_path.parent / "listeners.log"

def clip_log(value) -> str:
    # Cuts the log text when it is too long
    text = str(value)
    return text[:500] if len(text) > 500 else text

def write_log(target, level, message):
    # Writes the message and appends the traceback on error
    msg = clip_log(message)
    if level == "error" and sys.exc_info()[0]:
        msg = f"{msg}\n{traceback.format_exc()}"
    getattr(target, level)(msg)

def setup_logging():
    # Main function for log creation, will be called across the whole project
    log_path.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(log_label)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S UTC",
    )
    if not logger.handlers:
        file = RotatingFileHandler(log_path, maxBytes=10485760, backupCount=5, encoding="utf-8")
        file.setLevel(logging.DEBUG)
        file.setFormatter(formatter)
        logger.setLevel(logging.DEBUG)
        logger.addHandler(file)
        console = logging.StreamHandler()
        console.setLevel(logging.DEBUG)
        console.setFormatter(formatter)
        logger.addHandler(console)
        logger.propagate = False
    if not listener_logger.handlers:
        listeners_file = RotatingFileHandler(
            listeners_log_path, maxBytes=10485760, backupCount=5, encoding="utf-8"
        )
        listeners_file.setLevel(logging.DEBUG)
        listeners_file.setFormatter(formatter)
        listener_logger.setLevel(logging.DEBUG)
        listener_logger.addHandler(listeners_file)
        listeners_console = logging.StreamHandler()
        listeners_console.setLevel(logging.DEBUG)
        listeners_console.setFormatter(formatter)
        listener_logger.addHandler(listeners_console)
        listener_logger.propagate = False

async def global_exception_handler(request: Request, exc: Exception):
    # Here is where unhandled exceptions are logged and a generic error is returned
    msg = clip_log(f"Unhandled exception | {request.method} {request.url.path}")
    trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    logger.error(f"{msg}\n{trace}")
    return ORJSONResponse(status_code=500, content={"detail": "Internal server error"})
