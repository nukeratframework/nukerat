import json
from datetime import datetime
from infra.database.database import Host
from infra.database.listener_utils import listener_utils


async def check_host(body):
    # Updates the host last seen time from the body
    try:
        data = json.loads(body.decode("utf-8", errors="replace"))
    except (json.JSONDecodeError, AttributeError):
        return
    if isinstance(data, list):
        data = data[0] if data else {}
    tag = data.get("host") if isinstance(data, dict) else None
    if tag:
        await listener_utils.modify(Host, {"tag": tag}, {"last_seen": datetime.utcnow()})
