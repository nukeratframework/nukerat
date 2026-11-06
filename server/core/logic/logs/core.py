import asyncio
from pathlib import Path

from logic.conclude_logic import conclude_request
from .search import filter_lines
from .pagination import slice_page


def load_log_lines(log_dir: Path) -> list[str]:
    # Reads the server and listener log lines
    lines = []
    for name in ("server.log", "listeners.log"):
        path = log_dir / name
        if path.is_file():
            lines.extend(path.read_text(encoding="utf-8", errors="replace").splitlines())
    return lines


async def list_logs(body):
    # Lists the logs with search and pagination
    log_dir = Path(__file__).resolve().parents[3] / "logs"
    lines = await asyncio.to_thread(load_log_lines, log_dir)
    lines = [line for line in lines if line.strip()]
    lines.reverse()
    lines = await filter_lines(lines, body)
    logs, total, page, page_size = await slice_page(lines, body)

    return {
        "status": "success",
        "logs": logs,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


async def fetch_logs(query):
    # Returns the final logs response
    body = query.model_dump() if hasattr(query, "model_dump") else query
    return await conclude_request(await list_logs(body), type="logs")
