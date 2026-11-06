from datetime import datetime, timezone

from logic.reports.hosts.core import host_row
from logic.reports.source import format_report_html
from logic.reports.utils import esc, render_table
from infra.database.database import Ioc, sqlite_db

max_rows = 200
hash_types = ("md5", "sha1", "sha256")


def filter_by_hosts(rows: list, host_tags: list, host_field: str = "host_tag") -> list:
    # Keeps iocs that belong to the selected hosts
    if not host_tags:
        return rows
    return [
        row for row in rows
        if not getattr(row, host_field, None) or getattr(row, host_field, None) in host_tags
    ]


async def load_data(host_tags: list) -> dict:
    # Groups iocs into ips, domains, hashes and files
    iocs = filter_by_hosts(await sqlite_db.read(Ioc), host_tags)
    iocs.sort(key=lambda row: row.id or 0, reverse=True)

    grouped = {"ips": [], "domains": [], "hashes": [], "files": []}
    seen_hashes = set()
    for row in iocs[:max_rows]:
        value = row.value
        ioc_type = row.type
        if ioc_type == "ipv4" and value not in grouped["ips"]:
            grouped["ips"].append(value)
        elif ioc_type == "domain" and value not in grouped["domains"]:
            grouped["domains"].append(value)
        elif ioc_type == "file" and value not in grouped["files"]:
            grouped["files"].append(value)
        elif ioc_type in hash_types:
            key = (ioc_type, value)
            if key not in seen_hashes:
                seen_hashes.add(key)
                grouped["hashes"].append([ioc_type, value])

    return {"grouped": grouped}


def list_block(label: str, values: list[str]) -> str:
    # Builds an html block for one ioc list
    if not values:
        return f"<h2>{label}</h2><p>None identified</p>"
    items = "".join(f"<span class='badge'>{esc(value)}</span>" for value in values)
    return f"<h2>{label} ({len(values)})</h2><div>{items}</div>"


def build_html(name: str, description: str, hosts: list, data: dict) -> str:
    # Builds the ioc report html
    host_data = [host_row(host) for host in hosts]
    grouped = data["grouped"]
    host_table = render_table(
        ["Hostname", "User", "OS", "Internal IP", "External IP"],
        [[h["hostname"], h["user"], h["os"], h["ip"], h["external_ip"]] for h in host_data],
        5,
    )
    hashes = grouped.get("hashes", [])
    if hashes:
        hashes_block = f"<h2>Hashes ({len(hashes)})</h2>{render_table(['Type', 'Hash'], hashes, 2)}"
    else:
        hashes_block = "<h2>Hashes</h2><p>None identified</p>"

    generated = esc(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    body = f"""<h2>Target Scope ({len(host_data)})</h2>
{host_table}
{list_block("IP Addresses", grouped.get("ips", []))}
{list_block("Domains", grouped.get("domains", []))}
{list_block("Files", grouped.get("files", []))}
{hashes_block}"""
    return format_report_html(
        esc(name),
        f"Indicators of Compromise · Generated {generated}",
        esc(description),
        body,
    )
