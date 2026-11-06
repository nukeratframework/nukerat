from logic.conclude_logic import conclude_request
from logic.utils.disconnect import check_client_disconnect
from infra.database.database import CustomNotification, sqlite_db


async def new_custom(request=None):
    # Waits for new custom notifications and returns them
    tags0 = None
    while True:
        rows = await sqlite_db.read(CustomNotification)
        tags = set()
        for n in rows:
            tags.add(n.tag)
        if tags0 is None:
            tags0 = tags
        elif tags != tags0:
            out = []
            for n in rows:
                if n.tag not in tags0:
                    out.append({
                        "tag": n.tag,
                        "title": n.title,
                        "type": n.type or "info",
                        "description": n.description,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    })
            if out:
                return {"message": "successful", "custom": out}
            tags0 = tags
        # ========== orphaned connection =========
        if await check_client_disconnect(request, 1.0):
            return {"message": "successful", "custom": []}


async def fetch_custom_notifications(request=None):
    # Returns the final custom notifications response
    return await conclude_request(await new_custom(request), type="notifications_custom")
