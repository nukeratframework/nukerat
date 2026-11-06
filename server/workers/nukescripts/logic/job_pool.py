import queue
import threading

from infra.general.create_log import logger, write_log

worker_count = 4
job_queue = None
pool_workers = []
pool_started = False
pool_start_lock = threading.Lock()


def worker_loop(worker_id):
    # Takes jobs from the queue and runs them
    while True:
        fn, args, kwargs = job_queue.get()
        try:
            fn(*args, **kwargs)
        except Exception as e:
            write_log(
                logger,
                "error",
                f"Unhandled exception | nukescripts/job_pool | worker={worker_id} | {e}",
            )
        finally:
            job_queue.task_done()


def start_job_pool(workers=worker_count):
    # Starts the worker threads of the job pool
    global job_queue, pool_started
    with pool_start_lock:
        if pool_started:
            return
        count = max(1, int(workers))
        job_queue = queue.Queue()
        for i in range(count):
            t = threading.Thread(
                target=worker_loop,
                args=(i,),
                daemon=True,
                name=f"nukescripts-job-{i}",
            )
            t.start()
            pool_workers.append(t)
        pool_started = True
        write_log(logger, "info", f"Job pool started ({count} workers).")


def enqueue_scripts_event(event, row, handler):
    # Puts the event on the job queue
    if not pool_started or job_queue is None:
        handler(event, row)
        return
    payload = dict(row) if isinstance(row, dict) else row
    job_queue.put((handler, (event, payload), {}))
