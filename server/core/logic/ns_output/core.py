from fastapi.responses import JSONResponse
from logic.conclude_logic import conclude_request
from logic.utils.disconnect import check_client_disconnect
from infra.database.database import NukeScriptsOutput, sqlite_db
def row_payload(row):
    # Turns one nukescript output row into a dict
    return {
        "id": str(row.id),
        "tag": row.tag,
        "content": row.content,
        "time": row.created_at.strftime("%Y/%m/%d - %H:%M") if row.created_at else "",
    }


async def list_output(request=None):
    # Waits for new nukescript output and returns it
    tags0 = None
    while True:
        rows = await sqlite_db.read(NukeScriptsOutput)
        tags = set()
        for row in rows:
            if row.tag:
                tags.add(row.tag)

        if tags0 is None:
            tags0 = tags
        elif tags != tags0:
            has_new = False
            for row in rows:
                if row.tag and row.tag not in tags0:
                    has_new = True
                    break
            if has_new:
                break
            tags0 = tags

        # ========== orphaned connection =========
        if await check_client_disconnect(request, 1.0):
            return JSONResponse(content={"status": "success", "content": []})

    new = []
    for row in rows:
        if row.tag and row.tag not in tags0:
            new.append(row)
    new.sort(key=lambda r: r.id or 0)

    content = []
    for row in new:
        content.append(row_payload(row))

    return JSONResponse(content={"status": "success", "content": content})


async def fetch_ns_output(request=None):
    # Returns the final nukescript output response
    return await conclude_request(await list_output(request), type="ns_output")
