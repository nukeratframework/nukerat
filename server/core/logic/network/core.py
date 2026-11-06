from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from logic.conclude_logic import conclude_request
from infra.listeners.socks.manage import (
    socks_listener,
    ListenerNotFoundError,
    ListenerStartupError,
    PortAlreadyInUseError,
)
from infra.listeners.port_forward.manage import port_forward_listener
from core.logic.listeners.http import parse_port
from core.logic.listeners.sync_access import listener_all, listener_get

managers = (socks_listener, port_forward_listener)


async def mgr_stop(session_id: str):
    # Stops the socks or port forward session
    for mgr in managers:
        if await listener_get(mgr, session_id):
            await mgr.stop(session_id)
            return
    raise ListenerNotFoundError(f"Listener '{session_id}' not found")


async def create_socks(data: dict):
    # Creates a socks connection
    try:
        session_id = await socks_listener.create(
            port=await parse_port(data.get("portToOpen")),
            config_data={
                "networkType": "socks",
                "authUser": data.get("authUser", ""),
                "authPass": data.get("authPass", ""),
                "hostTag": data.get("hostTag", ""),
            },
        )
        return JSONResponse(status_code=200, content={"status": "success", "message": "Connection created", "session_id": session_id})
    except PortAlreadyInUseError as e:
        return JSONResponse(status_code=409, content={"status": "failure", "message": str(e)})
    except ListenerStartupError as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except (KeyError, ValueError) as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def create_port_forward(data: dict):
    # Creates a port forward connection
    if (data.get("protocol") or "tcp").lower() != "tcp":
        return JSONResponse(status_code=400, content={"status": "failure", "message": "Only TCP supported"})
    try:
        session_id = await port_forward_listener.create(
            port=await parse_port(data.get("portToOpen")),
            config_data={
                "networkType": "port_forwarding",
                "protocol": "tcp",
                "hostTag": data.get("hostTag", ""),
                "forwardHost": data.get("forwardHost", ""),
                "forwardPort": await parse_port(data.get("forwardPort")),
            },
        )
        return JSONResponse(status_code=200, content={"status": "success", "message": "Connection created", "session_id": session_id})
    except PortAlreadyInUseError as e:
        return JSONResponse(status_code=409, content={"status": "failure", "message": str(e)})
    except ListenerStartupError as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except (KeyError, ValueError) as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def remove_connection(data: dict):
    # Stops a network connection
    try:
        tag = (data.get("tag") or data.get("id") or "").strip()
        await mgr_stop(tag)
        return JSONResponse(status_code=200, content={"status": "success", "message": "Connection removed"})
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=404, content={"status": "failure", "message": str(e)})
    except KeyError as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def restart_connection(data: dict):
    # Restarts a network connection
    try:
        sid = data["id"]
        for mgr in managers:
            if await listener_get(mgr, sid):
                session_id = await mgr.restart(sid)
                return JSONResponse(status_code=200, content={"status": "success", "message": "Connection restarted", "session_id": session_id})
        raise ListenerNotFoundError(f"Listener '{sid}' not found")
    except ListenerNotFoundError as e:
        return JSONResponse(status_code=404, content={"status": "failure", "message": str(e)})
    except PortAlreadyInUseError as e:
        return JSONResponse(status_code=409, content={"status": "failure", "message": str(e)})
    except ListenerStartupError as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})
    except KeyError as e:
        return JSONResponse(status_code=400, content={"status": "failure", "message": str(e)})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | network | {e}")
        return JSONResponse(status_code=500, content={"status": "failure", "message": str(e)})


async def list_connections():
    # Lists the socks and port forward connections
    socks = await listener_all(socks_listener)
    port_forward = await listener_all(port_forward_listener)
    items = socks + port_forward
    return JSONResponse(status_code=200, content={"status": "success", "connections": items})


async def delete_connection(tag: str):
    # Returns the final response of a connection delete
    content = {"tag": tag}
    return await conclude_request(await remove_connection(content), body=content, type="network")


async def fetch_connections():
    # Returns the final connections response
    return await conclude_request(await list_connections(), type="network")


async def main_network(body):
    # Routes the network action to create or restart
    action = body.get("type")
    network_type = body.get("networkType")
    if action == "create":
        if network_type == "port_forwarding":
            return await conclude_request(await create_port_forward(body), body=body, type="network")
        return await conclude_request(await create_socks(body), body=body, type="network")
    if action == "restart":
        return await conclude_request(await restart_connection(body), body=body, type="network")
    return await conclude_request(
        {"status": "failure", "message": f"Unknown request type: '{action}'"},
        status_code=400,
        body=body,
        type="network",
    )
