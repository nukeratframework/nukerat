from infra.database.database import Host, sqlite_db
from logic.utils.disconnect import check_client_disconnect


async def new_hosts(request=None):
    # Waits for new hosts and returns them
    tags0 = None
    while True:
        rows = await sqlite_db.read(Host)
        tags = set()
        for h in rows:
            tags.add(h.tag)
        if tags0 is None:
            tags0 = tags
        elif tags != tags0:
            out = []
            for h in rows:
                if h.tag not in tags0:
                    out.append({
                        "tag": h.tag,
                        "ip": h.ip,
                        "os": h.os,
                        "hostname": h.hostname,
                        "first_seen": h.first_seen.isoformat() if h.first_seen else None,
                        "last_seen": h.last_seen.isoformat() if h.last_seen else None,
                        "delay": h.delay,
                    })
            if out:
                return {"message": "successful", "hosts": out}
            tags0 = tags
        # ========== orphaned connection =========
        if await check_client_disconnect(request, 1.0):
            return {"message": "successful", "hosts": []}
