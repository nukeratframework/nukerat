from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from infra.listeners.file_server.manage import file_server_listener
from infra.listeners.http.manage import (
    ListenerAlreadyExistsError,
    ListenerNotFoundError,
    ListenerStartupError,
    ListenerStopError,
    PortAlreadyInUseError,
)
from core.logic.listeners.http import parse_port, build_overrides
from core.logic.listeners.certs.core import apply_certs
from core.logic.listeners.sync_access import listener_all

async def create_file_server_listener(data: dict):
    # Creates a file server listener
    try:
        ssl = bool(data.get("ssl"))
        cert_pem = key_pem = None
        if ssl:
            data, cert_pem, key_pem = await apply_certs(data, required=True)
        session_id = await file_server_listener.create(
            host=data["host"],
            port=await parse_port(data["portToOpen"]),
            name=data.get("name", ""),
            config_data=data,
            cert_pem=cert_pem,
            key_pem=key_pem,
        )
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Listener created", "tag": session_id},
        )
    except (PortAlreadyInUseError, ListenerAlreadyExistsError) as e:
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Port already in use"})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/file_server | {e}")
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Internal error"})


async def remove_file_server_listener(data: dict):
    # Stops a file server listener
    try:
        tag = (data.get("tag") or data.get("id") or "").strip()
        if not tag:
            raise KeyError("tag")
        await file_server_listener.stop(tag)
        return JSONResponse(status_code=200, content={"status": "success", "message": "Listener removed"})
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Listener not found"})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/file_server | {e}")
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Internal error"})


async def restart_file_server_listener(data: dict):
    # Restarts a file server listener
    try:
        tag = (data.get("tag") or data.get("id") or "").strip()
        if not tag:
            raise KeyError("tag")
        new_tag = await file_server_listener.restart(tag, **await build_overrides(data))
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Listener restarted", "tag": new_tag},
        )
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Listener not found"})
    except (PortAlreadyInUseError, ListenerAlreadyExistsError) as e:
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Port already in use"})
    except (ListenerStartupError, ListenerStopError) as e:
        write_log(logger, "error", f"Unhandled exception | listeners/file_server | {e}")
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Listener startup error"})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/file_server | {e}")
        return JSONResponse(status_code=200, content={"status": "failure", "message": "Internal error"})


async def list_file_server_listeners():
    # Lists the file server listeners
    return await listener_all(file_server_listener)
