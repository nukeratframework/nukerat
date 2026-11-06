import time

from logic.events import start_events
from logic.job_pool import start_job_pool
from infra.general.create_log import logger, write_log


def main(ready=None):
    # Main function of the worker, starts the pool and the events
    start_job_pool()
    write_log(logger, "info", "Worker startup complete.")
    if ready is not None:
        ready.set()
    start_events()
    while True:
        time.sleep(3600)
