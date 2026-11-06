from infra.database.database import Terminal, sqlite_db
from infra.general.create_log import logger, write_log


async def terminal_output(tag):
    # Reads the terminal output of a queue line
    tag = (tag or "").strip()
    if not tag:
        return ""
    try:
        rows = await sqlite_db.read(Terminal, tag=tag)
        return rows[0].output if rows else ""
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | queue/terminal | {e}")
        return ""
