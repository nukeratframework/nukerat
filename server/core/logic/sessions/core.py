import asyncio
from datetime import datetime, timezone

from infra.database.database import Host, sqlite_db
from infra.general.create_log import logger, write_log
from logic.conclude_logic import conclude_request
from logic.utils.disconnect import check_client_disconnect
from logic.terminal.utils.command import enqueue
from .grap_chain import create_graph_hosts


def host_to_dict(host):
    # Turns a host row into a session dict
    last_activity = None
    if host.last_seen:
        now = datetime.now(timezone.utc)
        last_seen = host.last_seen
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        else:
            last_seen = last_seen.astimezone(timezone.utc)
        if (now - last_seen).total_seconds() < 1:
            last_activity = "< 1s"
        else:
            s = int((now - last_seen).total_seconds())
            if s < 60:
                last_activity = f"{s}s"
            elif s < 3600:
                last_activity = f"{s // 60}m"
            elif s < 86400:
                last_activity = f"{s // 3600}h"
            else:
                last_activity = f"{s // 86400}d"

    return {
        "id": host.id,
        "tag": host.tag,
        "ip": host.ip,
        "host_server": host.host_server or "",
        "host_port": host.host_port or "",
        "internal": host.ip,
        "external_ip": host.external_ip or "",
        "listener": host.listener,
        "privilege": "user" if host.privilege == "default" else host.privilege,
        "notes": host.notes or "",
        "process": host.process or "",
        "pid": host.pid,
        "arch": host.arch,
        "os": host.os,
        "user": host.user,
        "hostname": host.hostname,
        "first_seen": host.first_seen.isoformat() if host.first_seen else None,
        "last_seen": host.last_seen.isoformat() if host.last_seen else None,
        "last_activity": last_activity,
        "delay": host.delay,
        "implant_config": host.implant_config,
    }


async def list_sessions(body, request=None):
    # Lists the sessions or the session graph
    try:
        mode = body["mode"]

        if mode == "default":
            hosts = await sqlite_db.read(Host)
            result = []
            for host in hosts:
                result.append(host_to_dict(host))
            return {"status": "success", "sessions": result}

        if mode == "graphs" and body.get("long_polling") is False:
            hosts = await sqlite_db.read(Host)
            graph = await asyncio.to_thread(create_graph_hosts, hosts, host_to_dict)
            return {"status": "success", **graph}

        state0 = None
        while True:
            hosts = await sqlite_db.read(Host)
            state = {host.tag: (host.privilege, host.relays, host.host_server, host.host_port) for host in hosts}

            if state0 is None:
                state0 = state
            elif state != state0:
                break
            else:
                state0 = state

            # ========== orphaned connection =========
            if await check_client_disconnect(request, 1.0):
                break

        if mode == "graphs":
            graph = await asyncio.to_thread(create_graph_hosts, hosts, host_to_dict)
            return {"status": "success", **graph}

        result = []
        for host in hosts:
            result.append(host_to_dict(host))

        return {"status": "success", "sessions": result}
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | sessions | {e}")
        return {"status": "failure", "sessions": []}


async def fetch_sessions(body, request=None):
    # Returns the final sessions response
    return await conclude_request(await list_sessions(body, request), type="sessions")


async def patch_session(tag, body):
    # Updates the notes of a session
    tag = (tag or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    if not await sqlite_db.read(Host, tag=tag):
        return {"status": "failure", "message": "Session not found"}
    await sqlite_db.modify(Host, {"tag": tag}, {"notes": body.get("notes") or ""})
    return {"status": "success", "message": "Session updated"}


async def remove_session(tag: str):
    # Deletes a session
    tag = (tag or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    if not await sqlite_db.read(Host, tag=tag):
        return {"status": "failure", "message": "Session not found"}
    # await enqueue(tag, "kill", {"mode": "kill", "args": ""}, "kill")
    await sqlite_db.delete(Host, tag=tag)
    return {"status": "success", "message": "Session removed"}
