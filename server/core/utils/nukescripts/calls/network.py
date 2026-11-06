import asyncio
import json

from fastapi.responses import JSONResponse
from core.logic.network.core import create_port_forward, create_socks, remove_connection, restart_connection

main_loop = None


def parse_network_response(response):
    # Reads the network result from the response
    if isinstance(response, JSONResponse):
        data = json.loads(response.body.decode())
    elif isinstance(response, dict):
        data = response
    else:
        return "Invalid network response"

    status = data.get("status")
    message = data.get("message", "")
    if status == "success":
        session_id = data.get("session_id")
        if session_id:
            return f"{message} (session_id={session_id})"
        return message or "OK"
    if message:
        return message
    return "Network request failed"


async def send_add_socks(host_tag, port, user, password):
    # Opens a socks session on the host
    body = {
        "type": "create",
        "networkType": "socks",
        "portToOpen": port,
        "authUser": user,
        "authPass": password,
        "hostTag": host_tag,
    }
    response = await create_socks(body)
    return parse_network_response(response)


async def send_add_forward(host_tag, local_port, target_host, target_port):
    # Opens a port forward on the host
    body = {
        "type": "create",
        "networkType": "port_forwarding",
        "portToOpen": local_port,
        "protocol": "tcp",
        "hostTag": host_tag,
        "forwardHost": target_host,
        "forwardPort": target_port,
    }
    response = await create_port_forward(body)
    return parse_network_response(response)


async def send_remove(session_id):
    # Removes a network session
    response = await remove_connection({"id": session_id})
    return parse_network_response(response)


async def send_restart(session_id):
    # Restarts a network session
    response = await restart_connection({"id": session_id})
    return parse_network_response(response)


def dispatch_add_socks(host_tag, port, user, password):
    # Runs the socks call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_add_socks(host_tag, port, user, password),
        main_loop,
    )
    return future.result()


def dispatch_add_forward(host_tag, local_port, target_host, target_port):
    # Runs the port forward call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_add_forward(host_tag, local_port, target_host, target_port),
        main_loop,
    )
    return future.result()


def dispatch_remove(session_id):
    # Runs the remove call on the main loop
    future = asyncio.run_coroutine_threadsafe(send_remove(session_id), main_loop)
    return future.result()


def dispatch_restart(session_id):
    # Runs the restart call on the main loop
    future = asyncio.run_coroutine_threadsafe(send_restart(session_id), main_loop)
    return future.result()
