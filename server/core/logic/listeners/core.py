from infra.listeners.file_server.manage import file_server_listener
from core.logic.listeners.sync_access import listener_get
from logic.conclude_logic import conclude_request
from .http import (
    create_http_listener,
    remove_http_listener,
    restart_http_listener,
    list_http_listeners,
)
from .file_server import (
    create_file_server_listener,
    remove_file_server_listener,
    restart_file_server_listener,
    list_file_server_listeners,
)


async def listener_kind(content: dict) -> str:
    # Finds if the listener is http or file server
    sid = (content.get("tag") or content.get("id") or "").strip()
    if sid and await listener_get(file_server_listener, sid):
        return "file_server"
    kind = content.get("listenerType")
    if kind:
        return kind
    return "http"


async def delete_listener(tag: str):
    # Returns the final response of a listener delete
    content = {"tag": tag}
    kind = await listener_kind(content)
    if kind == "file_server":
        return await conclude_request(await remove_file_server_listener(content), body=content, type="listeners")
    return await conclude_request(await remove_http_listener(content), body=content, type="listeners")


async def fetch_listeners():
    # Returns the final listeners response
    return await conclude_request(
        {
            "status": "success",
            "active_channels": (
                (await list_http_listeners())
                + (await list_file_server_listeners())
            ),
        },
        type="listeners",
    )


async def main_listeners(content):
    # Routes the listener action to create or restart
    action = content.get("type")

    if action == "create":
        if content.get("listenerType") == "file_server":
            return await conclude_request(await create_file_server_listener(content), body=content, type="listeners")
        return await conclude_request(await create_http_listener(content), body=content, type="listeners")

    if action == "restart":
        kind = await listener_kind(content)
        if kind == "file_server":
            return await conclude_request(await restart_file_server_listener(content), body=content, type="listeners")
        return await conclude_request(await restart_http_listener(content), body=content, type="listeners")

    return await conclude_request(
        {"status": "failure", "message": f"Unknown request type: '{action}'"},
        status_code=400,
        body=content,
        type="listeners",
    )
