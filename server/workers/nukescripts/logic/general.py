from logic.parsing import has_event, inject_native_cmds, trigger_done
from infra.database.database import Queue, sqlite_db_sync as sqlite_db
from infra.general.create_log import logger, write_log
from utils.querys import active_scripts, approve_queue_tag


def execute_script(event, row, script):
    # Runs one script and records if it worked
    tag = script.get("tag", "?")
    try:
        inject_native_cmds(script.get("content", ""), event, row, script)
        sqlite_db.record_run(tag, True)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/script | script={tag} event={event} | {e}")
        sqlite_db.record_run(tag, False)


def run_scripts_for_event(event, row):
    # Runs every active script that matches the event
    scripts = active_scripts()
    matched = False
    for script in scripts:
        if not has_event(script.get("content"), event):
            continue
        matched = True
        execute_script(event, row, script)
    if event != "new_queue_line":
        return
    qtag = row.get("tag")
    if not qtag:
        return
    if not matched:
        approve_queue_tag(qtag)
        return
    rows = sqlite_db.read(Queue, tag=qtag)
    if not rows:
        return
    t = rows[0].nukescript_trigger
    if not trigger_done(t):
        approve_queue_tag(qtag)


def search_scripts_by_event(event, row):
    # Sends the event to the job pool
    from logic.job_pool import enqueue_scripts_event

    enqueue_scripts_event(event, row, run_scripts_for_event)
