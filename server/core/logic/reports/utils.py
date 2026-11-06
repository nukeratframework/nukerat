import json
import re
import base64
from html import escape
from datetime import datetime, timezone
from pathlib import Path

from infra.general.create_log import logger, write_log
reports_dir = Path(__file__).resolve().parents[3] / "infra" / "reports"


def artifact_file_type(meta: dict, path: Path) -> str:
    # Reads the report file type from the name or the meta
    file_name = (meta.get("file") or path.name or "").lower()
    if file_name.endswith(".json"):
        return "json"
    if file_name.endswith(".html"):
        return "html"
    if file_name.endswith(".pdf"):
        return "pdf"
    file_type = (meta.get("fileType") or "").strip().lower()
    if file_type in {"pdf", "html", "json"}:
        return file_type
    suffix = path.suffix.lstrip(".").lower()
    return suffix if suffix in {"pdf", "html", "json"} else "pdf"


def report_created_at(value, path: Path) -> str:
    # Formats the report creation time
    raw = str(value or "").strip()
    if raw:
        text = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
        try:
            return datetime.fromisoformat(text).strftime("%Y/%m/%d - %H:%M")
        except ValueError:
            pass
    if path.is_file():
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y/%m/%d - %H:%M")
    return ""


def fmt_dt(value) -> str:
    # Formats a datetime for the report
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%Y/%m/%d - %H:%M")
    return str(value)


def ensure_reports_dir() -> Path:
    # Creates the reports folder when it is missing
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def slug_name(name: str) -> str:
    # Turns the report name into a safe file piece
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", (name or "report").strip()).strip("-")
    return base[:80] or "report"


def report_meta_path(artifact_path: Path) -> Path:
    # Builds the meta file path of a report
    if artifact_path.suffix == ".json" and not artifact_path.name.endswith(".meta.json"):
        return artifact_path.with_name(f"{artifact_path.stem}.meta.json")
    return artifact_path.with_suffix(".json")


def report_html_path(pdf_path: Path) -> Path:
    # Builds the html path of a report
    return pdf_path.with_suffix(".html")


def write_html(pdf_path: Path, html: str) -> Path:
    # Writes the report html next to the artifact
    html_path = report_html_path(pdf_path)
    html_path.write_text(html, encoding="utf-8")
    return html_path


def write_meta(pdf_path: Path, meta: dict) -> None:
    # Writes the report meta file
    report_meta_path(pdf_path).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def read_meta(pdf_path: Path) -> dict:
    # Reads the report meta file
    path = report_meta_path(pdf_path)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | reports | {e}")
        return {}


def _read_tag_meta(root: Path, tag: str) -> dict | None:
    # Reads the meta of one report tag
    meta_path = (root / f"{tag}.meta.json").resolve()
    if meta_path.parent == root and meta_path.is_file():
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | reports | {e}")
            return None
    json_path = (root / f"{tag}.json").resolve()
    if json_path.parent != root or not json_path.is_file():
        return None
    if (root / f"{tag}.pdf").is_file():
        try:
            return json.loads(json_path.read_text(encoding="utf-8"))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | reports | {e}")
            return None
    try:
        doc = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | reports | {e}")
        return None
    if (doc.get("fileType") or "").strip().lower() == "html":
        return doc
    if (doc.get("file") or "").lower().endswith(".html") and (root / f"{tag}.html").is_file():
        return doc
    if _json_is_primary_artifact(doc):
        return doc
    return None


def _json_data_artifact(root: Path, tag: str) -> Path | None:
    # Finds the json file when it is the report itself
    json_path = (root / f"{tag}.json").resolve()
    if json_path.parent != root or not json_path.is_file():
        return None
    meta_path = (root / f"{tag}.meta.json").resolve()
    if meta_path.parent == root and meta_path.is_file():
        return json_path
    if (root / f"{tag}.pdf").is_file():
        return None
    try:
        doc = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | reports | {e}")
        return None
    if _json_is_primary_artifact(doc):
        return json_path
    return None


def _json_is_primary_artifact(meta: dict) -> bool:
    # Checks if the json file is the report itself
    if "data" in meta:
        return True
    return (meta.get("fileType") or "").strip().lower() == "json"


def resolve_report_path(tag: str) -> Path | None:
    # Finds the report file for a tag
    if not tag or not re.fullmatch(r"[\w.-]+", tag):
        return None
    root = ensure_reports_dir().resolve()
    pdf = (root / f"{tag}.pdf").resolve()
    html = (root / f"{tag}.html").resolve()
    json_path = (root / f"{tag}.json").resolve()

    if pdf.parent == root and pdf.is_file():
        return pdf

    data_path = _json_data_artifact(root, tag)
    if data_path is not None:
        return data_path

    meta = _read_tag_meta(root, tag)

    if html.parent == root and html.is_file():
        if meta:
            file_type = (meta.get("fileType") or "").strip().lower()
            file_name = (meta.get("file") or "").lower()
            if file_type == "html" or file_name.endswith(".html"):
                return html
        if not (json_path.parent == root and json_path.is_file()):
            return html

    return None


def delete_report_file(tag: str) -> bool:
    # Deletes the report file and its side files
    artifact_path = resolve_report_path(tag)
    if not artifact_path:
        return False
    if artifact_path.suffix == ".json":
        meta_path = report_meta_path(artifact_path)
        html_path = report_html_path(artifact_path)
        artifact_path.unlink()
        if meta_path.is_file():
            meta_path.unlink()
        if html_path.is_file():
            html_path.unlink()
        return True
    meta_path = report_meta_path(artifact_path)
    html_path = report_html_path(artifact_path)
    artifact_path.unlink()
    if meta_path.is_file():
        meta_path.unlink()
    if html_path.is_file() and html_path != artifact_path:
        html_path.unlink()
    return True


def read_report_file(tag: str) -> dict | None:
    # Reads the report file as base64
    artifact_path = resolve_report_path(tag)
    if not artifact_path:
        return None
    if artifact_path.suffix == ".json":
        meta = read_meta(artifact_path)
        if not meta:
            try:
                legacy = json.loads(artifact_path.read_text(encoding="utf-8"))
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | reports | {e}")
                return None
            meta = legacy
        filename = meta.get("file") or artifact_path.name
        return {
            "tag": artifact_path.stem,
            "name": meta.get("name") or artifact_path.stem,
            "file": filename,
            "fileType": artifact_file_type(meta, artifact_path),
            "created_at": report_created_at(meta.get("created_at"), artifact_path),
            "content": base64.b64encode(artifact_path.read_bytes()).decode("ascii"),
        }
    meta = read_meta(artifact_path)
    filename = meta.get("file") or artifact_path.name
    return {
        "tag": artifact_path.stem,
        "name": meta.get("name") or artifact_path.stem,
        "file": filename,
        "fileType": artifact_file_type(meta, artifact_path),
        "created_at": report_created_at(meta.get("created_at"), artifact_path),
        "content": base64.b64encode(artifact_path.read_bytes()).decode("ascii"),
    }


def read_report_html(tag: str) -> dict | None:
    # Reads the report html for the view
    artifact_path = resolve_report_path(tag)
    if not artifact_path:
        return None
    if artifact_path.suffix == ".html":
        meta = read_meta(artifact_path)
        return {
            "tag": artifact_path.stem,
            "name": meta.get("name") or artifact_path.stem,
            "created_at": report_created_at(meta.get("created_at"), artifact_path),
            "html": artifact_path.read_text(encoding="utf-8"),
        }
    if artifact_path.suffix == ".json":
        html_path = report_html_path(artifact_path)
        if not html_path.is_file():
            return None
        meta = read_meta(artifact_path)
        if not meta:
            try:
                meta = json.loads(artifact_path.read_text(encoding="utf-8"))
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | reports | {e}")
                return None
        return {
            "tag": artifact_path.stem,
            "name": meta.get("name") or artifact_path.stem,
            "created_at": report_created_at(meta.get("created_at"), artifact_path),
            "html": html_path.read_text(encoding="utf-8"),
        }
    html_path = report_html_path(artifact_path)
    if not html_path.is_file():
        return None
    meta = read_meta(artifact_path)
    return {
        "tag": artifact_path.stem,
        "name": meta.get("name") or artifact_path.stem,
        "created_at": report_created_at(meta.get("created_at"), artifact_path),
        "html": html_path.read_text(encoding="utf-8"),
    }


def list_report_files() -> list[dict]:
    # Lists the saved reports
    root = ensure_reports_dir()
    items = []
    seen = set()

    def append_item(path: Path, meta: dict) -> None:
        # Adds one report to the list when it is new
        if path.stem in seen:
            return
        seen.add(path.stem)
        items.append({
            "tag": path.stem,
            "name": meta.get("name") or path.stem,
            "description": meta.get("description") or "",
            "reportType": meta.get("reportType") or "",
            "fileType": artifact_file_type(meta, path),
            "hosts": meta.get("hosts") or [],
            "file": meta.get("file") or path.name,
            "created_at": report_created_at(meta.get("created_at"), path),
        })

    for pdf in sorted(root.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True):
        append_item(pdf, read_meta(pdf))
    for html in sorted(root.glob("*.html"), key=lambda p: p.stat().st_mtime, reverse=True):
        if html.stem in seen:
            continue
        append_item(html, read_meta(html))
    for json_path in sorted(root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        if json_path.name.endswith(".meta.json"):
            continue
        if (root / f"{json_path.stem}.pdf").is_file():
            continue
        if json_path.stem in seen:
            continue
        meta_path = root / f"{json_path.stem}.meta.json"
        if meta_path.is_file():
            append_item(json_path, read_meta(json_path))
            continue
        if (root / f"{json_path.stem}.html").is_file():
            try:
                doc = json.loads(json_path.read_text(encoding="utf-8"))
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | reports | {e}")
                continue
            if (doc.get("fileType") or "").strip().lower() == "html":
                continue
        try:
            doc = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | reports | {e}")
            continue
        if not _json_is_primary_artifact(doc):
            continue
        append_item(json_path, doc)

    items.sort(key=lambda row: row.get("created_at") or "", reverse=True)
    return items


def esc(value) -> str:
    # Escapes a value for the report html
    return escape(str(value if value is not None else ""), quote=True)


def render_table(headers: list[str], rows: list[list[str]], empty_colspan: int) -> str:
    # Builds an html table for the report
    nowrap = {
        i for i, header in enumerate(headers)
        if any(part in header.strip().lower() for part in ("time", "user", "host"))
    }
    head = "".join(
        f'<th class="whitespace-nowrap">{esc(h)}</th>' if i in nowrap else f"<th>{esc(h)}</th>"
        for i, h in enumerate(headers)
    )
    if not rows:
        body = f"<tr><td colspan='{empty_colspan}'>No records</td></tr>"
    else:
        body = "".join(
            "<tr>"
            + "".join(
                f'<td class="whitespace-nowrap">{esc(c)}</td>' if i in nowrap else f"<td>{esc(c)}</td>"
                for i, c in enumerate(row)
            )
            + "</tr>"
            for row in rows
        )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"
