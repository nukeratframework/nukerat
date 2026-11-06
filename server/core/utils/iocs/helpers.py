from infra.database.database import Ioc, sqlite_db
from utils.querys import generate_tag


async def ioc_exists(host_tag: str, ioc_type: str, value: str) -> bool:
    # Checks if this ioc is already stored for the host
    rows = await sqlite_db.read(Ioc, host_tag=host_tag, type=ioc_type, value=value)
    return bool(rows)


async def save_ioc(host_tag: str, ioc_type: str, value: str, level: int = 0) -> None:
    # Stores one ioc when it is not already in the DB
    text = str(value).strip()
    if not text:
        return
    if await ioc_exists(host_tag, ioc_type, text):
        return
    await sqlite_db.write(Ioc(
        tag=generate_tag(),
        type=ioc_type,
        value=text,
        host_tag=host_tag,
        level=level,
    ))


async def save_iocs(host_tag: str, items: list[tuple[str, str, int]]) -> None:
    # Stores every ioc from the list
    for ioc_type, value, level in items:
        await save_ioc(host_tag, ioc_type, value, level)
