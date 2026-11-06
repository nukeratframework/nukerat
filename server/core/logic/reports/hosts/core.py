from datetime import datetime, timezone

from logic.reports.source import format_report_html
from logic.reports.utils import esc, render_table

max_rows = 200


def host_row(host) -> dict:
    # Turns a host into a report row
    return {
        "tag": host.tag,
        "ip": host.ip or "-",
        "external_ip": host.external_ip or "-",
        "user": host.user or "-",
        "hostname": host.hostname or "-",
        "os": host.os or "-",
        "pid": host.pid if host.pid is not None else "-",
    }


def build_html(name: str, description: str, hosts: list) -> str:
    # Builds the hosts report html
    rows_data = [host_row(host) for host in hosts[:max_rows]]
    table = render_table(
        ["Hostname", "User", "OS", "Internal IP", "External IP", "PID"],
        [[h["hostname"], h["user"], h["os"], h["ip"], h["external_ip"], h["pid"]] for h in rows_data],
        6,
    )
    generated = esc(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    body = f"""<h2>Compromised Hosts ({len(rows_data)})</h2>
{table}"""
    return format_report_html(
        esc(name),
        f"Hosts Report · Generated {generated}",
        esc(description),
        body,
    )
