from datetime import datetime, timezone

from logic.reports.hosts.core import host_row
from logic.reports.source import format_report_html
from logic.reports.utils import esc, fmt_dt, render_table
from infra.database.database import Credentials, Queue, sqlite_db

max_rows = 200


def filter_by_hosts(rows: list, host_tags: list, host_field: str = "host") -> list:
    # Keeps rows that belong to the selected hosts
    if not host_tags:
        return rows
    return [row for row in rows if getattr(row, host_field, None) in host_tags]


def queue_row(row) -> dict:
    # Turns a queue row into a short report row
    command = row.command or ""
    if len(command) > 300:
        command = command[:300] + "..."
    return {
        "host": row.host,
        "command": command,
        "created_at": fmt_dt(row.created_at),
    }


async def load_data(host_tags: list) -> dict:
    # Loads queue and credential rows for the activity report
    queue = filter_by_hosts(await sqlite_db.read(Queue), host_tags)
    credentials = filter_by_hosts(await sqlite_db.read(Credentials), host_tags, "host")

    queue.sort(key=lambda row: row.id or 0, reverse=True)
    credentials.sort(key=lambda row: row.id or 0, reverse=True)

    return {
        "queue": [
            queue_row(row) for row in queue[:max_rows]
            if (row.type or "").strip().lower() == "terminal"
        ],
        "credentials": [
            {
                "host": row.host,
                "name": row.name,
                "content": (row.content or "")[:400],
                "description": row.description or "",
                "created_at": fmt_dt(row.created_at),
            }
            for row in credentials[:max_rows]
        ],
    }


def build_html(name: str, description: str, hosts: list, data: dict, hide_credentials: bool = False) -> str:
    # Builds the activity report html
    host_data = [host_row(host) for host in hosts]
    host_map = {h["tag"]: h for h in host_data}
    host_table = render_table(
        ["Hostname", "User", "OS", "Internal IP", "External IP"],
        [[h["hostname"], h["user"], h["os"], h["ip"], h["external_ip"]] for h in host_data],
        5,
    )
    queue_rows = []
    for row in data["queue"]:
        if (row["command"] or "").strip().lower() == "skip":
            continue
        queue_rows.append([
            row["created_at"],
            host_map.get(row["host"], {}).get("hostname", row["host"]),
            host_map.get(row["host"], {}).get("user", "-"),
            row["command"],
        ])
    queue_table = render_table(
        ["Time", "Hostname", "User", "Command"],
        queue_rows,
        4,
    )
    cred_rows = []
    for row in data["credentials"]:
        content = row["content"]
        if hide_credentials and len(content) > 3:
            content = content[:3] + "*" * (len(content) - 3)
        cred_rows.append([
            row["created_at"], row["host"], row["name"], content, row["description"] or "-"
        ])
    cred_table = render_table(
        ["Time", "Host", "Name", "Content", "Description"],
        cred_rows,
        5,
    )
    generated = esc(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    body = f"""<h2>Target Scope ({len(host_data)})</h2>
{host_table}
<h2>Queue Activity ({len(queue_rows)})</h2>
{queue_table}
<h2>Captured Credentials ({len(data["credentials"])})</h2>
{cred_table}"""
    return format_report_html(
        esc(name),
        f"Activity Report · Generated {generated}",
        esc(description),
        body,
    )
