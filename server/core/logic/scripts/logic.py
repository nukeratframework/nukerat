from infra.database.database import NukeScripts, sqlite_db
from utils.querys import generate_tag
from .validation.base import validate_syntax_async


async def list_scripts():
    # Lists the scripts
    rows = await sqlite_db.read(NukeScripts)
    return {
        "status": "success",
        "content": [
            {
                "tag": r.tag,
                "name": r.name,
                "description": r.description or "",
                "content": r.content,
                "status": 1 if r.status == 1 else 0,
                "last_run": r.last_run.strftime("%Y/%m/%d - %H:%M") if r.last_run else "",
                "errors_count": r.errors_count or 0,
                "success_count": r.success_count or 0,
                "created_at": r.created_at.strftime("%Y/%m/%d - %H:%M") if r.created_at else "",
            }
            for r in rows
        ],
    }


async def add_script(body):
    # Stores a new script after the syntax check
    name = (body.get("name") or "").strip()
    content = body.get("content") or ""
    description = (body.get("description") or "").strip() or None
    if not name:
        return {"status": "failure", "message": "Missing name"}
    if not content.strip():
        return {"status": "failure", "message": "Missing content"}
    check = await validate_syntax_async(content)
    if check.get("status") != "success":
        return check
    tag = generate_tag()
    row = NukeScripts(
        tag=tag,
        name=name,
        description=description,
        content=content,
        status=0,
    )
    await sqlite_db.write(row)
    return {"status": "success", "message": "Script created", "tag": tag}


async def edit_script(body):
    # Updates a script after the syntax check
    name = (body.get("name") or "").strip()
    content = body.get("content") or ""
    description = (body.get("description") or "").strip() or None
    if not content.strip():
        return {"status": "failure", "message": "Missing content"}
    check = await validate_syntax_async(content)
    if check.get("status") != "success":
        return check
    tag = (body.get("tag") or "").strip()
    if not tag:
        return {"status": "failure", "message": "Missing tag"}
    if not await sqlite_db.read(NukeScripts, tag=tag):
        return {"status": "failure", "message": "Not found"}
    await sqlite_db.modify(
        NukeScripts,
        {"tag": tag},
        {"name": name, "content": content, "description": description},
    )
    return {"status": "success", "message": "Script updated"}


async def delete_script(body):
    # Deletes a script when the content matches
    tag = (body.get("tag") or "").strip()
    if not tag:
        return {"status": "failure", "message": "Missing tag"}
    rows = await sqlite_db.read(NukeScripts, tag=tag)
    if not rows:
        return {"status": "failure", "message": "Not found"}
    if rows[0].content != (body.get("content") or ""):
        return {"status": "failure", "message": "Content mismatch"}
    await sqlite_db.delete(NukeScripts, tag=tag)
    return {"status": "success", "message": "Script removed"}


async def change_status(body):
    # Turns a script on or off after the syntax check
    tag = (body.get("tag") or "").strip()
    try:
        value = int(body.get("status"))
    except (TypeError, ValueError):
        return {"status": "failure", "message": "Invalid tag or status"}
    if not tag:
        return {"status": "failure", "message": "Missing tag"}
    if value not in (0, 1):
        return {"status": "failure", "message": "Invalid status"}
    rows = await sqlite_db.read(NukeScripts, tag=tag)
    if not rows:
        return {"status": "failure", "message": "Not found"}
    if value == 1:
        check = await validate_syntax_async(rows[0].content)
        if check.get("status") != "success":
            return check
    await sqlite_db.modify(NukeScripts, {"tag": tag}, {"status": value})
    return {"status": "success", "message": "Script updated"}
