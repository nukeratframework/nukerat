import asyncio


async def listener_all(manager):
    # Reads all listeners from the manager
    return await asyncio.to_thread(manager.all)


async def listener_get(manager, session_id: str):
    # Reads one listener from the manager
    return await asyncio.to_thread(manager.get, session_id)
