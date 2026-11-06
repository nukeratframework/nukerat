from utils.iocs.endpoint.file_server import run as file_server_run
from utils.iocs.endpoint.terminal import run as terminal_run


async def main(body: dict, source: str = "terminal") -> None:
    # Routes the body to the file server or terminal ioc handler
    try:
        if source == "file_server":
            await file_server_run(body)
            return
        await terminal_run(body)
    except Exception:
        pass
