import contextvars
import logging
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

logging.Formatter.converter = time.gmtime
log_label = contextvars.ContextVar("log_label", default="server")
log_record_factory_set = False
logger = logging.getLogger("launcher")
log_path = Path(__file__).resolve().parent.parent.parent / "logs" / "server.log"

def setup_logging():
    # Main function for log creation, sets the file and console handlers
    global log_record_factory_set

    if not log_record_factory_set:
        old = logging.getLogRecordFactory()

        def inject(*args, **kwargs):
            # Injects the log label into each log record
            record = old(*args, **kwargs)
            record.log_label = log_label.get()

            return record

        logging.setLogRecordFactory(inject)
        log_record_factory_set = True

    log_path.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(log_label)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S UTC",
    )
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

handlers = {
    "file": {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": str(log_path),
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
