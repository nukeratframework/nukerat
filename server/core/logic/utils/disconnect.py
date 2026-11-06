import asyncio


def arm_disconnect_watcher(request):
    # Arms a watcher that marks when the client disconnects
    if request is None:
        return None
    event = getattr(request.state, "client_disconnect_event", None)
    if event is not None:
        return event
    event = asyncio.Event()

    async def run_disconnect_watcher():
        # Waits for the client disconnect and sets the event
        while True:
            message = await request.receive()
            if message["type"] == "http.disconnect":
                event.set()
                return

    setattr(request.state, "client_disconnect_event", event)
    setattr(
        request.state,
        "client_disconnect_watcher",
        asyncio.create_task(run_disconnect_watcher()),
    )
    return event


async def check_client_disconnect(request, seconds=1.0, test=0):
    # Checks if the client disconnected within the timeout
    if request is None:
        await asyncio.sleep(seconds)
        return False

    event = arm_disconnect_watcher(request)
    if event is None:
        await asyncio.sleep(seconds)
        return False

    if event.is_set():
        return True

    try:
        await asyncio.wait_for(event.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        return False

    return True
