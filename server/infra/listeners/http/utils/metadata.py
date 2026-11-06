import json
from ipaddress import ip_address
from fastapi import Request
from infra.database.database import Host
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def process_metadata(body, request: Request | None = None):
    # Stores the implant metadata fields on the host row
    try:
        if not isinstance(body, dict):
            return

        host_tag = body.get("host") or body.get("host_tag") or body.get("tag")
        if not host_tag:
            return

        metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        privilege = metadata.get("privilege") or "default"
        relays = json.dumps(metadata["relays"]) if isinstance(metadata.get("relays"), list) else None

        changes = {"privilege": privilege, "relays": relays}
        internal_ip = metadata.get("internal_ip")
        if internal_ip:
            changes["ip"] = internal_ip

        host_server = metadata.get("host")
        if host_server is not None and str(host_server).strip():
            changes["host_server"] = str(host_server).strip()

        host_port = metadata.get("port")
        if host_port is not None and str(host_port).strip():
            changes["host_port"] = str(host_port).strip()

        if request and request.client:
            origin_ip = request.client.host
            try:
                if origin_ip and ip_address(origin_ip.strip()).is_global:
                    changes["external_ip"] = origin_ip.strip()
            except ValueError:
                pass

        await listener_utils.modify(
            Host,
            {"tag": host_tag},
            changes,
        )
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http/metadata | {e}")
