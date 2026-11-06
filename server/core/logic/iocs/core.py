from logic.conclude_logic import conclude_request
from logic.queue.pagination import slice_page
from infra.database.database import Ioc, sqlite_db


async def list_iocs(body: dict):
    q = (body.get("search") or "").strip().lower()
    host_tags = []
    for item in body.get("hostTags") or []:
        text = (item or "").strip()
        if text and text not in host_tags:
            host_tags.append(text)
    rows = await sqlite_db.read(Ioc, order_desc_id=True)
    items = []
    for r in rows:
        if host_tags and (r.host_tag or "") not in host_tags:
            continue
        hay = f"{r.tag} {r.host_tag or ''} {r.type} {r.value}".lower()
        if r.created_at:
            hay += f" {r.created_at.strftime('%Y/%m/%d - %H:%M')} {r.created_at.isoformat()}"
        if q and q not in hay:
            continue
        items.append({
            "tag": r.tag,
            "type": r.type,
            "value": r.value,
            "hostTag": r.host_tag or "",
            "createdAt": r.created_at.strftime("%Y/%m/%d - %H:%M") if r.created_at else "",
        })
    content, total, page, page_size = await slice_page(items, body)
    return {
        "status": "success",
        "content": content,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


async def fetch_iocs(query):
    body = query.model_dump() if hasattr(query, "model_dump") else query
    return await conclude_request(await list_iocs(body), type="iocs")


async def remove_ioc(tag: str):
    tag = (tag or "").strip()
    if not tag:
        return await conclude_request(
            {"status": "failure", "message": "Tag required"},
            status_code=400,
            type="iocs",
        )
    if not await sqlite_db.read(Ioc, tag=tag):
        return await conclude_request(
            {"status": "failure", "message": "Not found"},
            status_code=404,
            type="iocs",
        )
    await sqlite_db.delete(Ioc, tag=tag)
    return await conclude_request({"status": "success", "message": "Removed"}, type="iocs")
