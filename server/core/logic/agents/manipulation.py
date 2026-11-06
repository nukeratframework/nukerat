import json
from infra.database.database import Agents, sqlite_db
from utils.querys import generate_tag
from .utills.validation import mask_api_key


async def duplicate_field(field: str, value: str, exclude_id: int | None = None) -> bool:
    # Checks if another agent already uses the field
    if not hasattr(Agents, field):
        return False
    needle = (value or "").strip().casefold()
    if not needle:
        return False
    for row in await sqlite_db.read(Agents):
        if exclude_id is not None and row.id == exclude_id:
            continue
        current = getattr(row, field, None)
        if isinstance(current, str) and current.strip().casefold() == needle:
            return True
    return False


async def list_agents(body):
    # Lists the agents
    rows = await sqlite_db.read(Agents)
    agents = []
    for r in rows:
        row = {"id": str(r.id), "tag": r.tag or "", "name": r.name, "type": r.type}
        if r.is_custom:
            row["endpoint"] = r.endpoint or ""
            row["headers"] = json.loads(r.headers) if r.headers else []
            row["bodyTemplate"] = r.body_template or ""
            row["responseField"] = r.response_field or ""
        else:
            row["apiKey"] = r.api_key or ""
        agents.append(row)
    return {"status": "success", "agents": agents}


async def create_agent(body):
    # Stores a new agent
    cfg = body.get("config") or {}
    name = (cfg.get("name") or "").strip()
    if not name:
        return {"status": "failure", "message": "Name required"}
    if await duplicate_field("name", name):
        return {"status": "failure", "message": "Name already exists"}
    typ = cfg.get("type") or "deepseek"
    custom = typ == "custom"
    row = Agents(
        tag=generate_tag(),
        name=name,
        type=typ,
        is_custom=1 if custom else 0,
        api_key=cfg.get("apiKey") if not custom else None,
        endpoint=cfg.get("endpoint") if custom else None,
        headers=json.dumps(cfg.get("headers") or []) if custom else None,
        body_template=cfg.get("bodyTemplate") if custom else None,
        response_field=cfg.get("responseField") if custom else None,
    )
    await sqlite_db.write(row)
    return {"status": "success", "message": "Agent created", "tag": row.tag}


async def update_agent(body):
    # Updates an agent
    tag = (body.get("tag") or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    rows = await sqlite_db.read(Agents, tag=tag)
    if not rows:
        return {"status": "failure", "message": "Agent not found"}
    agent = rows[0]
    cfg = body.get("config") or {}
    name = (cfg.get("name") or "").strip()
    if not name:
        return {"status": "failure", "message": "Name required"}
    if await duplicate_field("name", name, exclude_id=agent.id):
        return {"status": "failure", "message": "Name already exists"}
    typ = cfg.get("type") or "deepseek"
    custom = typ == "custom"
    await sqlite_db.modify(
        Agents,
        {"tag": tag},
        {
            "name": name,
            "type": typ,
            "is_custom": 1 if custom else 0,
            "api_key": cfg.get("apiKey") if not custom else None,
            "endpoint": cfg.get("endpoint") if custom else None,
            "headers": json.dumps(cfg.get("headers") or []) if custom else None,
            "body_template": cfg.get("bodyTemplate") if custom else None,
            "response_field": cfg.get("responseField") if custom else None,
        },
    )
    return {"status": "success", "message": "Agent updated"}


async def delete_agent(body):
    # Deletes an agent
    tag = (body.get("tag") or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    if not await sqlite_db.read(Agents, tag=tag):
        return {"status": "failure", "message": "Agent not found"}
    await sqlite_db.delete(Agents, tag=tag)
    return {"status": "success", "message": "Agent removed"}
