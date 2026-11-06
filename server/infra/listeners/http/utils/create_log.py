import json
from .mapping import action_mapping
from pathlib import Path
from infra.database.listener_utils import listener_utils
from infra.general.create_log import listener_logger as logger, setup_logging, write_log

server_log_path = Path(__file__).resolve().parent.parent.parent.parent.parent / "logs" / "server.log"


async def create_log(body, msg, level="info"):
    # Writes the listener log with the host ip and the action
    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except (json.JSONDecodeError, AttributeError):
        data = {}
    if isinstance(data, list):
        data = data[0] if data else {}
    action = action_mapping.get(data.get("option"), "unknown")
    host_ip = await listener_utils.get_host_ip(data.get("host"))
    write_log(logger, level, f"{msg} | {host_ip} | {action}")


handlers = {
    "file": {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": str(server_log_path),
        "maxBytes": 10485760,
        "backupCount": 5,
        "encoding": "utf-8",
        "formatter": "default",
        "level": "DEBUG",
    },
}
handlers["console"] = {"class": "logging.StreamHandler", "formatter": "default", "level": "WARNING"}

targets = ["file", "console"]

loggers = {
    "uvicorn.error": {"handlers": ["file"], "level": "DEBUG", "propagate": False},
    "uvicorn.access": {"handlers": ["file"], "level": "DEBUG", "propagate": False},
    "app": {"handlers": targets, "level": "DEBUG", "propagate": False},
    "fastapi": {"handlers": targets, "level": "DEBUG", "propagate": False},
}

log_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)s | %(log_label)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S UTC",
        }
    },
    "handlers": handlers,
    "loggers": loggers,
}
