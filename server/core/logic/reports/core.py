import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from weasyprint import HTML
from weasyprint.urls import URLFetcher
from logic.conclude_logic import conclude_request
from infra.database.database import Host, sqlite_db
from .activity.core import build_html as build_activity_html
from .activity.core import load_data as load_activity_data
from .hosts.core import build_html as build_hosts_html
from .hosts.core import host_row
from .ioc.core import build_html as build_ioc_html
from .ioc.core import load_data as load_ioc_data
from .utils import (
    ensure_reports_dir,
    slug_name,
    write_meta,
    write_html,
    list_report_files,
    delete_report_file,
    read_report_file,
    read_report_html,
)

report_types = {"activity", "hosts", "ioc"}


class _ClosedFetcher(URLFetcher):
    def fetch(self, url, headers=None):
        # Blocks remote fetches while the pdf is built
        raise ValueError("blocked")


_fetcher = _ClosedFetcher()


def save_report_artifacts(html: str, pdf_path: Path, meta: dict) -> None:
    # Writes the pdf, the html and the meta
    HTML(string=html, url_fetcher=_fetcher).write_pdf(str(pdf_path))
    write_html(pdf_path, html)
    write_meta(pdf_path, meta)


def save_report_html_artifact(html: str, html_path: Path, meta: dict) -> None:
    # Writes the html report and the meta
    html_path.write_text(html, encoding="utf-8")
    write_meta(html_path, meta)


def save_report_json_artifact(payload: dict, json_path: Path) -> None:
    # Writes the json report
    json_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


async def resolve_hosts(host_tags: list | None) -> list:
    # Keeps only the selected hosts
    all_hosts = await sqlite_db.read(Host)
    tags = []
    for item in host_tags or []:
        text = (item or "").strip()
        if text and text not in tags:
            tags.append(text)
    if not tags:
        return all_hosts
    return [host for host in all_hosts if host.tag in tags]


async def create_report(body):
    # Builds and stores a new report
    name = (body.get("name") or "").strip()
    description = (body.get("description") or "").strip()
    report_type = (body.get("reportType") or "").strip().lower()

    if not name:
        return {"status": "failure", "message": "Name required"}
    if report_type not in report_types:
        return {"status": "failure", "message": "Invalid report type"}

    file_type = (body.get("fileType") or "pdf").strip().lower()
    if file_type not in {"pdf", "html", "json"}:
        return {"status": "failure", "message": "Invalid file type"}

    hosts = await resolve_hosts(body.get("hostTags"))
    host_tags = [host.tag for host in hosts]

    if report_type == "hosts":
        html = build_hosts_html(name, description, hosts)
    elif report_type == "activity":
        hide_credentials = bool(body.get("hideCredentials"))
        html = build_activity_html(
            name, description, hosts, await load_activity_data(host_tags), hide_credentials
        )
    else:
        html = build_ioc_html(name, description, hosts, await load_ioc_data(host_tags))

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    tag = f"{slug_name(name)}-{stamp}"
    filename = f"{tag}.{file_type}"
    artifact_path = ensure_reports_dir() / filename
    meta = {
        "name": name,
        "description": description,
        "reportType": report_type,
        "fileType": file_type,
        "hosts": host_tags,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "file": filename,
    }
    if file_type == "pdf":
        await asyncio.to_thread(save_report_artifacts, html, artifact_path, meta)
    elif file_type == "json":
        if report_type == "hosts":
            data = {"hosts": [host_row(host) for host in hosts]}
        elif report_type == "activity":
            data = {
                "hosts": [host_row(host) for host in hosts],
                **await load_activity_data(host_tags),
            }
        else:
            data = {
                "hosts": [host_row(host) for host in hosts],
                "ioc": await load_ioc_data(host_tags),
            }
        await asyncio.to_thread(save_report_json_artifact, data, artifact_path)
        await asyncio.to_thread(write_meta, artifact_path, meta)
        await asyncio.to_thread(write_html, artifact_path, html)
    else:
        await asyncio.to_thread(save_report_html_artifact, html, artifact_path, meta)

    return {
        "status": "success",
        "message": "Report created",
        "tag": tag,
        "report": {
            "tag": tag,
            "name": name,
            "description": description,
            "reportType": report_type,
            "fileType": file_type,
            "hosts": host_tags,
            "file": filename,
            "created_at": datetime.fromisoformat(
                (meta["created_at"] or "").replace("Z", "+00:00")
            ).strftime("%Y/%m/%d - %H:%M")
            if meta.get("created_at")
            else "",
        },
    }


async def fetch_reports():
    # Returns the final reports list
    reports = await asyncio.to_thread(list_report_files)
    return await conclude_request({"status": "success", "reports": reports}, type="reports")


async def remove_report(tag: str):
    # Returns the final response of a report delete
    tag = (tag or "").strip()
    if not tag:
        return await conclude_request(
            {"status": "failure", "message": "Tag required"},
            status_code=400,
            type="reports",
        )
    deleted = await asyncio.to_thread(delete_report_file, tag)
    if not deleted:
        return await conclude_request(
            {"status": "failure", "message": "Report not found"},
            status_code=404,
            type="reports",
        )
    return await conclude_request({"status": "success", "message": "Report removed"}, type="reports")


async def get_report_download(tag: str):
    # Returns the final report download
    tag = (tag or "").strip()
    if not tag:
        return await conclude_request(
            {"status": "failure", "message": "Tag required"},
            status_code=400,
            type="reports",
        )
    payload = await asyncio.to_thread(read_report_file, tag)
    if not payload:
        return await conclude_request(
            {"status": "failure", "message": "Report not found"},
            status_code=404,
            type="reports",
        )
    return await conclude_request({"status": "success", **payload}, type="reports")


async def get_report_view(tag: str):
    # Returns the final report view
    tag = (tag or "").strip()
    if not tag:
        return await conclude_request(
            {"status": "failure", "message": "Tag required"},
            status_code=400,
            type="reports",
        )
    payload = await asyncio.to_thread(read_report_html, tag)
    if not payload:
        return await conclude_request(
            {"status": "failure", "message": "Report preview not available"},
            status_code=404,
            type="reports",
        )
    return await conclude_request({"status": "success", **payload}, type="reports")


async def main_reports(body):
    # Returns the final response of a new report
    return await conclude_request(await create_report(body), body=body, type="reports")
