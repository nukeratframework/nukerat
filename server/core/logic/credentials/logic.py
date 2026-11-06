from infra.database.database import Credentials, sqlite_db
from utils.querys import generate_tag


async def list_credentials():
    # Lists the credentials
    rows = await sqlite_db.read(Credentials)
    return {
        "status": "success",
        "credentials": [
            {
                "tag": r.tag,
                "name": r.name,
                "server": r.server,
                "host": r.host,
                "desc": r.description or "",
                "content": r.content or "",
            }
            for r in rows
        ],
    }


async def create_credentials(data):
    # Stores a new credential
    name = (data.get("name") or "").strip()
    server = (data.get("server") or "").strip()
    host = (data.get("host") or "").strip()
    content = (data.get("content") or "").strip()
    desc = (data.get("desc") or data.get("description") or "").strip() or None
    if not name or not server or not host or not content:
        return {"status": "failure", "message": "Missing fields"}
    tag = generate_tag()
    row = Credentials(
        tag=tag,
        name=name,
        server=server,
        host=host,
        content=content,
        description=desc,
    )
    await sqlite_db.write(row)
    return {"status": "success", "message": "Credential created", "tag": tag}


async def edit_credentials(tag: str, data):
    # Updates a credential
    tag = (tag or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    if not await sqlite_db.read(Credentials, tag=tag):
        return {"status": "failure", "message": "Credential not found"}
    name = (data.get("name") or "").strip()
    server = (data.get("server") or "").strip()
    host = (data.get("host") or "").strip()
    content = (data.get("content") or "").strip()
    desc = (data.get("desc") or data.get("description") or "").strip() or None
    if not name or not server or not host or not content:
        return {"status": "failure", "message": "Missing fields"}
    await sqlite_db.modify(
        Credentials,
        {"tag": tag},
        {"name": name, "server": server, "host": host, "content": content, "description": desc},
    )
    return {"status": "success", "message": "Credential updated"}


async def delete_credentials(tag: str):
    # Deletes a credential
    tag = (tag or "").strip()
    if not tag:
        return {"status": "failure", "message": "Tag required"}
    if not await sqlite_db.read(Credentials, tag=tag):
        return {"status": "failure", "message": "Credential not found"}
    await sqlite_db.delete(Credentials, tag=tag)
    return {"status": "success", "message": "Credential removed"}
