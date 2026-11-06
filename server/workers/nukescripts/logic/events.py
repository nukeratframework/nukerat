import time
import threading
from datetime import datetime, timedelta

from logic.general import search_scripts_by_event
from infra.database.database import (
    Host,
    Keylogger,
    Queue,
    Checkin,
    Folders,
    Process,
    Terminal,
    Credentials,
    Listener,
    sqlite_db_sync as sqlite_db,
)
from infra.general.create_log import logger, write_log
from utils.querys import max_row_id, rows_after_id, all_rows, row_to_dict

poll = 1
grace = 30

heartbeats = (
    ("heartbeat_1s", 1),
    ("heartbeat_5s", 5),
    ("heartbeat_10s", 10),
    ("heartbeat_15s", 15),
    ("heartbeat_30s", 30),
    ("heartbeat_1m", 60),
    ("heartbeat_5m", 300),
    ("heartbeat_10m", 600),
    ("heartbeat_15m", 900),
    ("heartbeat_20m", 1200),
    ("heartbeat_30m", 1800),
    ("heartbeat_60m", 3600),
    ("heartbeat_2h", 7200),
    ("heartbeat_12h", 43200),
    ("heartbeat_1d", 86400),
    ("heartbeat_3d", 259200),
    ("heartbeat_7d", 604800),
    ("heartbeat_15d", 1296000),
    ("heartbeat_30d", 2592000),
)


class EventScheduler:
    def __init__(self):
        # Class init, loads the last seen rows and heartbeats
        self.last_heartbeat = {name: 0.0 for name, _ in heartbeats}
        self.new_rows_last_id = {
            "new_host": max_row_id(Host),
            "keylogger_update": max_row_id(Keylogger),
            "new_queue_line": max_row_id(Queue),
            "new_checkin": max_row_id(Checkin),
            "output_received": max_row_id(Terminal),
            "credentials_update": max_row_id(Credentials),
            "listeners_update": max_row_id(Listener),
        }
        self.removed_host_known = all_rows(Host)
        self.folders_known = self._row_snapshot(Folders, "host", "path", "type", "modified", "size")
        self.process_known = self._row_snapshot(Process, "host", "tag", "tree")
        self.queue_errors_seen = self._queue_errors_seen()
        self.queue_completed_seen = self._queue_completed_seen()

    @staticmethod
    def _row_snapshot(model, *columns):
        # Stores a snapshot of the selected columns
        known = {}
        for rid, row in all_rows(model).items():
            known[rid] = tuple(row.get(col) for col in columns)
        return known

    @staticmethod
    def _queue_errors_seen():
        # Collects the queue rows that already have an error
        seen = set()
        for rid, row in all_rows(Queue).items():
            error = row.get("error")
            if error and str(error).strip():
                seen.add(rid)
        return seen

    @staticmethod
    def _queue_completed_seen():
        # Collects the queue rows that already finished
        seen = set()
        for rid, row in all_rows(Queue).items():
            error = row.get("error")
            if row.get("is_completed") == 1 and not (error and str(error).strip()):
                seen.add(rid)
        return seen

    def tick_new_rows(self, model, event_name):
        # Fires the event for rows added since the last check
        last_id = self.new_rows_last_id[event_name]
        new_rows = rows_after_id(model, last_id)
        for row in new_rows:
            rid = row.get("id")
            if rid is None:
                continue
            search_scripts_by_event(event_name, row)
            last_id = max(last_id, rid)
        self.new_rows_last_id[event_name] = last_id

    def tick_rows_remove(self, model, event_name):
        # Fires the event for hosts that were removed
        current = all_rows(model)
        for rid in self.removed_host_known:
            if rid not in current:
                search_scripts_by_event(event_name, self.removed_host_known[rid])
        self.removed_host_known = current

    def tick_expired_hosts(self, event_name):
        # Fires the event for hosts past the checkin grace
        now = datetime.utcnow()
        for row in sqlite_db.read(Host):
            if row.status != "active" or not row.next_checkin:
                continue
            if now <= row.next_checkin + timedelta(seconds=grace):
                continue
            search_scripts_by_event(event_name, row_to_dict(row))
            sqlite_db.modify(Host, {"tag": row.tag}, {"status": "expired"})

    def tick_row_changes(self, model, event_name, known, *columns):
        # Fires the event when the watched columns change
        current = all_rows(model)
        for rid, row in current.items():
            sig = tuple(row.get(col) for col in columns)
            if rid not in known or known[rid] != sig:
                search_scripts_by_event(event_name, row)
            known[rid] = sig
        for rid in list(known):
            if rid not in current:
                del known[rid]

    def tick_queue_errors(self, event_name):
        # Fires the event for new queue errors
        current = all_rows(Queue)
        for rid, row in current.items():
            error = row.get("error")
            if rid in self.queue_errors_seen or not error or not str(error).strip():
                continue
            search_scripts_by_event(event_name, row)
            self.queue_errors_seen.add(rid)
        for rid in list(self.queue_errors_seen):
            if rid not in current:
                self.queue_errors_seen.remove(rid)

    def tick_queue_completed(self, event_name):
        # Fires the event for queue rows that finished
        current = all_rows(Queue)
        for rid, row in current.items():
            error = row.get("error")
            if rid in self.queue_completed_seen or row.get("is_completed") != 1:
                continue
            if error and str(error).strip():
                continue
            search_scripts_by_event(event_name, row)
            self.queue_completed_seen.add(rid)
        for rid in list(self.queue_completed_seen):
            if rid not in current:
                self.queue_completed_seen.remove(rid)

    def tick_heartbeats(self, now):
        # Fires each heartbeat when its interval is due
        for name, seconds in heartbeats:
            if now - self.last_heartbeat[name] < seconds:
                continue
            try:
                search_scripts_by_event(name, {})
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | nukescripts/heartbeat | event={name} | {e}")
            self.last_heartbeat[name] = now

    def tick_watchers(self):
        # Here is where every watcher is called
        self.tick_new_rows(Host, "new_host")
        self.tick_rows_remove(Host, "removed_host")
        self.tick_expired_hosts("expired_host")
        self.tick_new_rows(Keylogger, "keylogger_update")
        self.tick_new_rows(Queue, "new_queue_line")
        self.tick_queue_errors("implant_error")
        self.tick_queue_completed("task_completed")
        self.tick_new_rows(Checkin, "new_checkin")
        self.tick_row_changes(
            Folders,
            "folders_update",
            self.folders_known,
            "host",
            "path",
            "type",
            "modified",
            "size",
        )
        self.tick_row_changes(
            Process,
            "process_update",
            self.process_known,
            "host",
            "tag",
            "tree",
        )
        self.tick_new_rows(Terminal, "output_received")
        self.tick_new_rows(Credentials, "credentials_update")
        self.tick_new_rows(Listener, "listeners_update")

    def run(self):
        # Main loop of the scheduler
        while True:
            now = time.monotonic()
            try:
                self.tick_heartbeats(now)
                self.tick_watchers()
            except Exception as e:
                write_log(logger, "error", f"Unhandled exception | nukescripts/scheduler_tick | {e}")
            time.sleep(poll)


def run_scheduler():
    # Starts the event scheduler loop
    EventScheduler().run()


def start_events():
    # Starts the scheduler in a background thread
    threading.Thread(target=run_scheduler, daemon=True, name="nukescripts-scheduler").start()
