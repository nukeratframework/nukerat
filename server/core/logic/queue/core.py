from fastapi.responses import JSONResponse
from logic.conclude_logic import conclude_request
from infra.database.database import Host, Queue, sqlite_db
from utils.querys import delete_queue_line
from .search import filter_rows
from .pagination import slice_page
from .terminal import terminal_output
from .sanitization import sanitize_parameters, sanitize_text


async def list_queue(body):
    # Lists the queue lines with search and pagination
    rows = await sqlite_db.read(Queue, order_desc_id=True)
    hosts = await sqlite_db.read(Host)
    host_map = {h.tag: h.hostname for h in hosts if h.tag}
    rows = await filter_rows(rows, body, host_map)
    items = []
    for r in rows:
        items.append({
            "tag": r.tag,
            "host": host_map.get(r.host, r.host),
            "hostTag": r.host,
            "type": r.type,
            "input": sanitize_text(r.input),
            "parameters": sanitize_parameters(r.parameters),
            "isCompleted": r.is_completed,
            "error": sanitize_text(r.error or ""),
            "customResponse": sanitize_text(r.custom_response or ""),
            "captured": r.captured or 0,
            "createdAt": r.created_at.strftime("%Y/%m/%d - %H:%M") if r.created_at else "",
            "output": sanitize_text(await terminal_output(r.tag)),
        })
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


async def fetch_queue(query):
    # Returns the final queue response
    body = query.model_dump() if hasattr(query, "model_dump") else query
    return await conclude_request(await list_queue(body), type="queue")


async def remove_queue(tag: str):
    # Deletes a queue line
    if not await sqlite_db.read(Queue, tag=tag):
        return JSONResponse(status_code=404, content={"status": "failure", "message": "Not found"})
    await delete_queue_line(tag)
    return JSONResponse(content={"status": "success", "message": "Removed"})


async def delete_queue_route(tag: str):
    # Returns the final response of a queue delete
    return await conclude_request(await remove_queue(tag), type="queue")
