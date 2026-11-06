from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from infra.listeners.http.manage import (
    http_listener,
    ListenerAlreadyExistsError,
    ListenerNotFoundError,
    ListenerStartupError,
    ListenerStopError,
    PortAlreadyInUseError,
)
from core.logic.listeners.certs.core import apply_certs
from core.logic.listeners.sync_access import listener_all

async def parse_port(raw_port) -> int:
    # Turns the port into an int inside the valid range
    port = int(raw_port)
    if port < 1 or port > 65535:
        raise ValueError("Port must be between 1 and 65535")
    return port


async def build_overrides(data: dict) -> dict:
    # Builds the listener fields that can be changed
    overrides = {}
    if "name" in data:
        overrides["name"] = data["name"]
    if "host" in data:
        overrides["host"] = data["host"]
    if "portToOpen" in data or "port" in data:
        overrides["port"] = await parse_port(data.get("portToOpen", data.get("port")))
    if "ssl" in data:
        overrides["ssl"] = bool(data["ssl"])
    if "certfile" in data:
        overrides["certfile"] = data["certfile"] or None
    if "keyfile" in data:
        overrides["keyfile"] = data["keyfile"] or None
    return overrides


async def create_http_listener(data: dict):
    # Creates an http listener
    try:
        channel_payload = data.get("channelPayload", "http")
        cert = data.get("cert") or {}
        ssl = channel_payload == "https" and cert.get("enabled", False)
        cert_pem = None
        key_pem = None
        if ssl:
            data, cert_pem, key_pem = await apply_certs(data, required=True)
        session_id = await http_listener.create(
            host=data["host"],
            port=await parse_port(data["portToOpen"]),
            name=data.get("name", ""),
            ssl=ssl,
            config_data=data,
            cert_pem=cert_pem,
            key_pem=key_pem,
        )
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Listener created", "tag": session_id},
        )
    except (PortAlreadyInUseError, ListenerAlreadyExistsError) as e:
        return JSONResponse(status_code=409, content={"status": "failure", "message": str(e)})
    except ListenerStartupError as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except (KeyError, ValueError) as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def remove_http_listener(data: dict):
    # Stops an http listener
    try:
        tag = (data.get("tag") or data.get("id") or "").strip()
        if not tag:
            raise KeyError("tag")
        await http_listener.stop(tag)
        return JSONResponse(status_code=200, content={"status": "success", "message": "Listener removed"})
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=404, content={"status": "failure", "message": str(e)})
    except ListenerStopError as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except KeyError as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def restart_http_listener(data: dict):
    # Restarts an http listener
    try:
        tag = (data.get("tag") or data.get("id") or "").strip()
        if not tag:
            raise KeyError("tag")
        overrides = await build_overrides(data)
        overrides["config_data"] = data
        new_tag = await http_listener.restart(tag, **overrides)
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Listener restarted", "tag": new_tag},
        )
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=404, content={"status": "failure", "message": str(e)})
    except (PortAlreadyInUseError, ListenerAlreadyExistsError) as e:
        return JSONResponse(status_code=409, content={"status": "failure", "message": str(e)})
    except (ListenerStartupError, ListenerStopError) as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except KeyError as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def list_http_listeners():
    # Lists the http listeners
    return await listener_all(http_listener)
