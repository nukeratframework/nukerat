import asyncio
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from utils.querys import generate_tag
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from infra.database.cell_limits import clamp_cell_value
from infra.database.database import (
    Checkin,
    Folders,
    Host,
    Process,
    Queue,
    Terminal,
    sqlite_db,
)
from infra.general.create_log import listener_logger, logger, write_log

def parse_download_tmp_path(stored_output: str | None) -> Path | None:
    # Reads the tmp path stored in the output
    prev = (stored_output or "").strip()
    if not prev:
        return None
    raw = prev.split("|", 1)[0].strip()
    if not raw:
        return None
    return Path(raw)


def is_server_download_tmp(path: Path) -> bool:
    # Checks if the path is a server tmp file
    return path.is_absolute() and path.parent.name == "tmp"


def unlink_download_tmp_path(path: Path | None) -> None:
    # Deletes the tmp file when it belongs to the server
    if not path or not is_server_download_tmp(path):
        return
    try:
        if path.is_file():
            path.unlink(missing_ok=True)
    except OSError:
        pass


def cleanup_download_tmp_for_tag_sync(tag: str) -> None:
    # Deletes the download tmp file of the tag
    with sqlite_db.sync_session() as session:
        t_result = session.execute(select(Terminal).filter(Terminal.tag == tag).limit(1))
        t_row = t_result.scalars().first()
        if not t_row:
            return
        unlink_download_tmp_path(parse_download_tmp_path(t_row.output))


store_lock = threading.Lock()


async def run_db(func, *args, **kwargs):
    # Runs a sync DB call in a thread
    return await asyncio.to_thread(func, *args, **kwargs)


def read_rows(model, **filters):
    # Reads rows from the DB
    return sqlite_db.read_sync(model, **filters)


def write_row(instance):
    # Stores a new row in the DB
    sqlite_db.write_sync(instance)


def modify_rows(model, filters, changes):
    # Updates rows in the DB
    sqlite_db.modify_sync(model, filters, changes)


def get_pending_command_sync(host):
    # Returns the pending terminal command of the host
    with sqlite_db.sync_session() as session:
        result = session.execute(
            select(Terminal)
            .filter(
                Terminal.host == host,
                Terminal.input != "",
                Terminal.output == "",
            )
            .limit(1)
        )
        return result.scalars().first()


def get_queue_action_sync(host):
    # Returns the ready queue actions of the host
    with sqlite_db.sync_session() as session:
        result = session.execute(
            select(Queue).filter(
                Queue.host == host,
                Queue.input != "",
                Queue.is_completed == 0,
                Queue.captured == 0,
                Queue.is_ready == 1,
            )
        )
        rows = result.scalars().all()
        out = []
        for row in rows:
            params = row.parameters or "{}"
            try:
                params = json.loads(params) if isinstance(params, str) else params
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | listener_utils/pending_command | {e}")
                params = {}
            if not isinstance(params, dict):
                params = {}
            out.append(
                {
                    "type": row.type,
                    "task_tag": row.tag,
                    "host": row.host,
                    "input": row.input,
                    "parameters": params,
                }
            )
        return out


def wait_response_sync(tag, delay=30):
    # Waits for the terminal output or returns timeout
    import time

    for _ in range(delay):
        with sqlite_db.sync_session() as session:
            result = session.execute(select(Terminal).filter(Terminal.tag == tag))
            row = result.scalars().first()
            if row and row.output:
                return {"status": "success", "output": row.output}
        time.sleep(1)
    return {"status": "failure", "message": "timeout"}


def apply_task_error_sync(tag, error_msg):
    # Stores the task error and marks the queue completed
    with sqlite_db.sync_session() as session:
        result = session.execute(select(Queue).filter(Queue.tag == tag).limit(1))
        row = result.scalars().first()
        if not row:
            return {"status": "failure", "error": "queue not found"}

        session.execute(
            update(Queue).filter_by(id=row.id).values(
                error=clamp_cell_value(error_msg), is_completed=1
            )
        )
        session.commit()

    return {"status": "success", "message": "output received successfully"}


def set_queue_output_ok_sync(tag):
    # Marks the queue line as completed
    with sqlite_db.sync_session() as session:
        result = session.execute(select(Queue).filter(Queue.tag == tag).limit(1))
        row = result.scalars().first()
        if not row:
            return {"status": "failure", "error": "queue not found"}

        session.execute(update(Queue).filter_by(id=row.id).values(is_completed=1))
        session.commit()

    return {"status": "success", "message": "output received successfully"}


def check_queue_tag_sync(tag):
    # Checks if the queue line still accepts output
    with sqlite_db.sync_session() as session:
        result = session.execute(select(Queue).filter(Queue.tag == tag).limit(1))
        row = result.scalars().first()
        if not row:
            return {"status": "failure", "error": "queue not found"}

        if row.is_completed == 1:
            return {"status": "failure", "message": "task already completed"}

    return {"status": "success", "message": "output received successfully"}


# ======= download =======

def check_queue_tag_download_sync(tag, content):
    # Allows more download chunks when the task is still open
    """Allow further implant chunks while a multi-part download is in progress."""
    more = False
    if isinstance(content, dict):
        raw = content.get("more")
        if isinstance(raw, bool):
            more = raw
        elif isinstance(raw, (int, float)):
            more = int(raw) != 0
        elif isinstance(raw, str):
            more = raw.strip().lower() in ("1", "true", "yes")

    with sqlite_db.sync_session() as session:
        result = session.execute(select(Queue).filter(Queue.tag == tag).limit(1))
        row = result.scalars().first()
        if not row:
            return {"status": "failure", "error": "queue not found"}

        if row.error:
            return {"status": "failure", "error": row.error}

        if row.is_completed != 1:
            return {"status": "success", "message": "ok"}

        if more:
            session.execute(
                update(Queue).filter_by(id=row.id).values(is_completed=0, error=None)
            )
            session.commit()
            return {"status": "success", "message": "download chunk resume"}

        t_result = session.execute(select(Terminal).filter(Terminal.tag == tag).limit(1))
        t_row = t_result.scalars().first()
        prev = (t_row.output or "").strip() if t_row else ""
        if prev and "|" in prev:
            session.execute(
                update(Queue).filter_by(id=row.id).values(is_completed=0, error=None)
            )
            session.commit()
            return {"status": "success", "message": "download chunk resume"}

        return {"status": "failure", "message": "task already completed"}

def abort_task_queue_sync(tag, error_msg="Auto killed task"):
    # Marks the queue as aborted and stores the error
    with sqlite_db.sync_session() as session:
        result = session.execute(select(Queue).filter(Queue.tag == tag).limit(1))
        row = result.scalars().first()
        if not row:
            return {"status": "failure", "error": "queue not found"}

        session.execute(
            update(Queue).filter_by(id=row.id).values(
                is_completed=1, error=clamp_cell_value(error_msg)
            )
        )
        session.commit()

    return {"status": "success", "message": "queue aborted"}


class listener_utils:
    """DB access for HTTP listener threads (separate asyncio loops). Uses sync SQLite via thread pool."""

    @classmethod
    async def read(cls, model, **filters):
        # Reads rows from the DB
        return await run_db(read_rows, model, **filters)

    @classmethod
    async def write(cls, instance):
        # Stores a new row in the DB
        await run_db(write_row, instance)

    @classmethod
    async def modify(cls, model, filters, changes):
        # Updates rows in the DB
        await run_db(modify_rows, model, filters, changes)

    @classmethod
    async def delete(cls, model, **filters):
        # Deletes rows from the DB
        return await run_db(sqlite_db.delete_sync, model, **filters)

    @classmethod
    async def put(cls, key, value):
        # Stores a value in the memory store
        def put_store():
            # Writes the key into the memory store
            with store_lock:
                sqlite_db._store[key] = value

        await run_db(put_store)

    @classmethod
    async def store_get(cls, key, default=None):
        # Reads a value from the memory store
        def get_store():
            # Reads the key from the memory store
            with store_lock:
                return sqlite_db._store.get(key, default)

        return await run_db(get_store)

    @classmethod
    async def store_set(cls, key, value):
        # Stores a value in the memory store
        await cls.put(key, value)

    @classmethod
    async def store_update(cls, key, changes):
        # Updates a dict already stored in memory
        def update_store():
            # Applies the changes to the stored dict
            with store_lock:
                if key in sqlite_db._store and isinstance(sqlite_db._store[key], dict):
                    sqlite_db._store[key].update(changes)

        await run_db(update_store)

    @staticmethod
    async def add_host(data):
        # Receives the host data and stores the new host
        hostColumns = {
            "option": True,
            "tag": True,
            "ip": True,
            "external_ip": True,
            "listener": True,
            "notes": False,
            "process": False,
            "pid": True,
            "arch": True,
            "os": True,
            "user": True,
            "hostname": True,
            "info": False,
            "delay": True,
            "implant_config": True,
            "metadata": False,
            "first_seen": False,
            "last_seen": False,
            "created_at": False,
        }
        error = {}
        missing = [k for k, required in hostColumns.items() if required and k not in data]

        if missing:
            error = "Missing required fields: " + ", ".join(missing)

        if error:
            return {"status": "failure", "error": error}

        try:
            info = data.get("info")
            if isinstance(info, (dict, list)):
                info = json.dumps(info)

            metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
            implant_cfg = data.get("implant_config") if isinstance(data.get("implant_config"), dict) else {}
            host_server = str(metadata.get("host") or implant_cfg.get("host") or "").strip()
            host_port = str(metadata.get("port") or implant_cfg.get("port") or "").strip()

            host = Host(
                tag=data["tag"],
                ip=data["ip"],
                host_server=host_server,
                host_port=host_port,
                external_ip=data["external_ip"],
                listener=data["listener"],
                notes=data.get("notes"),
                process=str(data["process"]) if data.get("process") is not None else None,
                pid=int(data["pid"]) if data.get("pid") is not None else None,
                arch=data["arch"],
                os=data["os"],
                user=data["user"],
                hostname=data["hostname"],
                info=info,
                delay=int(data["delay"]),
                implant_config=json.dumps(data["implant_config"])
                if isinstance(data.get("implant_config"), dict)
                else data.get("implant_config"),
            )
            await listener_utils.write(host)
            return {"status": "success", "message": "host included"}
        except IntegrityError as e:
            if "NOT NULL" in str(e.orig):
                return {"status": "failure", "error": "missing required fields"}
            if "UNIQUE constraint" in str(e.orig):
                return {"status": "success", "message": "host already exists"}
            write_log(logger, "error", f"Unhandled exception | add_host | {e}")
            return {"status": "failure", "error": "unexpected database error (add_host)"}
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | add_host | {e}")
            return {"status": "failure", "error": str(e)}

    @staticmethod
    async def get_pending_command(host):
        # Returns the pending terminal command of the host
        return await run_db(get_pending_command_sync, host)

    @staticmethod
    async def get_host_ip(tag):
        # Returns the ip of the host
        if not tag:
            return "unknown"
        rows = await listener_utils.read(Host, tag=tag)
        return rows[0].ip if rows else "unknown"

    @staticmethod
    async def get_queue_action(host):
        # Returns the ready queue actions of the host
        return await run_db(get_queue_action_sync, host)

    @staticmethod
    async def wait_response(tag, delay=30):
        # Waits for the terminal output or returns timeout
        return await run_db(wait_response_sync, tag, delay)

    @staticmethod
    async def apply_task_error(tag, error_msg):
        # Stores the task error and marks the queue completed
        return await run_db(apply_task_error_sync, tag, error_msg)

    @staticmethod
    async def set_queue_output_ok(tag):
        # Marks the queue line as completed
        return await run_db(set_queue_output_ok_sync, tag)

    @staticmethod
    async def check_queue_tag(tag):
        # Checks if the queue line still accepts output
        return await run_db(check_queue_tag_sync, tag)

    # ======= download =======
    @staticmethod
    async def check_queue_tag_download(tag, content):
        # Allows more download chunks when the task is still open
        return await run_db(check_queue_tag_download_sync, tag, content)

    # ========================

    @staticmethod
    async def log_checkin(content):
        # Stores a checkin line from the implant payload
        try:
            if not content:
                return
            data = json.loads(content.decode("utf-8", errors="replace"))
            if isinstance(data, list):
                if not data or not isinstance(data[0], dict):
                    return
                item = data[0]
                ctype = "output"
            elif isinstance(data, dict):
                item = data
                task_tag = item.get("task_tag")
                if item.get("error") and task_tag:
                    ctype = "error"
                elif item.get("option") == "input":
                    ctype = "input"
                elif item.get("option") == "output":
                    ctype = "output"
                elif item.get("option") == "new":
                    ctype = "new"
                elif item.get("option") == "kill_task":
                    ctype = "kill_task"
                else:
                    ctype = "invalid"
            else:
                return
            host = item.get("host") or item.get("host_tag") or (
                item.get("tag") if item.get("option") == "new" else None
            )
            if not host or not isinstance(host, str):
                return
            # tag = generate_tag()
            # await listener_utils.write(Checkin(tag=tag, host=host, type=ctype))
            for _ in range(5):
                tag = generate_tag()
                try:
                    await listener_utils.write(Checkin(tag=tag, host=host, type=ctype))
                    return
                except IntegrityError as e:
                    if "UNIQUE constraint" in str(e.orig):
                        continue
                    write_log(logger, "error", f"Unhandled exception | checkin | {e}")
                    return
            write_log(logger, "error", f"Unhandled exception | checkin | duplicate tag")
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | checkin | {e}")
            return

    @staticmethod
    async def set_status_active(content):
        # Marks the host as active and updates the next checkin
        try:
            if not content:
                return
            data = json.loads(content.decode("utf-8", errors="replace"))
            if isinstance(data, list):
                item = data[0] if data and isinstance(data[0], dict) else None
            elif isinstance(data, dict):
                item = data
            else:
                return
            if not item:
                return
            host = item.get("host") or item.get("host_tag") or (
                item.get("tag") if item.get("option") == "new" else None
            )
            if not host:
                return
            rows = await listener_utils.read(Host, tag=host)
            if not rows:
                return
            now = datetime.utcnow()
            delay = int(rows[0].delay or 0)
            await listener_utils.modify(
                Host,
                {"tag": host},
                {
                    "status": "active",
                    "last_seen": now,
                    "next_checkin": now + timedelta(seconds=delay),
                },
            )
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | set_status_active | {e}")
            return

    @staticmethod
    async def abort_task_queue(tag, error_msg="Auto killed task"):
        # Aborts the queue line and deletes the download tmp file
        result = await run_db(abort_task_queue_sync, tag, error_msg)
        await run_db(cleanup_download_tmp_for_tag_sync, tag)
        return result

    @staticmethod
    async def cleanup_download_tmp_for_tag(tag: str):
        # Deletes the download tmp file of the tag
        return await run_db(cleanup_download_tmp_for_tag_sync, tag)
