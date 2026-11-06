#!/usr/bin/env python3

from utils.setup_path import activate

activate()

from logic.core import main
from infra.general.create_log import logger, write_log

try:
    main()
except KeyboardInterrupt:
    write_log(logger, "info", "shutting down")
except Exception as e:
    write_log(logger, "error", f"Unhandled exception | nukescripts/main | {e}")
    raise
