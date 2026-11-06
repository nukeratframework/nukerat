import random
import string

from sqlalchemy import select
from infra.database.database import CustomNotification, NukeScripts, NukeScriptsOutput, Queue, sqlite_db_sync as sqlite_db

def row_to_dict(row):
    # Turns a DB row into a dict
    out = {}
    for c in row.__table__.columns:
        out[c.name] = getattr(row, c.name)
    return out


def max_row_id(model):
    # Returns the highest id of the table
    rows = sqlite_db.read(model)
    return max((r.id or 0) for r in rows) if rows else 0


def rows_after_id(model, last_id):
    # Returns the rows with id above the last one
    sqlite_db.start()
    with sqlite_db.session() as s:
        rows = s.scalars(select(model).where(model.id > last_id).order_by(model.id)).all()
    return [row_to_dict(r) for r in rows]


def all_rows(model):
    # Returns every row of the table as a dict
    return {r.id: row_to_dict(r) for r in sqlite_db.read(model) if r.id is not None}


def list_all_scripts():
    # Returns every nukescript stored in the DB
    rows = sqlite_db.read(NukeScripts)
    out = []
    for r in rows:
        out.append(row_to_dict(r))
    return out


def active_scripts():
    # Returns only the nukescripts that are active
    out = []
    for s in list_all_scripts():
        if s.get("status") == 1:
            out.append(s)
    return out


def approve_queue_tag(tag):
    # Marks the queue line as approved
    sqlite_db.modify(Queue, {"tag": tag}, {"nukescript_trigger": "approved"})


def reject_queue_tag(tag, script_name, line_input):
    # Marks the queue line as rejected and completed
    error = f"Blocked by NukeScript rule (source: {script_name})"
    sqlite_db.modify(Queue, {"tag": tag}, {"nukescript_trigger": "rejected", "is_completed": 1, "error": error})


def conclude_queue_tag(tag, message):
    # Stores the custom response and marks the line completed
    sqlite_db.modify(Queue, {"tag": tag}, {"custom_response": message, "is_completed": 1})


def add_custom_notification(title, description, type="info"):
    # Stores a custom notification in the DB
    tag = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    sqlite_db.write(CustomNotification(tag=tag, title=title, type=type, description=description))


def add_nukescript_output(content):
    # Stores the nukescript output in the DB
    tag = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    sqlite_db.write(NukeScriptsOutput(tag=tag, content=content))
