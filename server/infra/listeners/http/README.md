# Overview

HTTP listener the implants check in on. `manage.py` starts the uvicorn servers and restores the listener rows from the database.

## Directories

- `/routes`: route entrypoints, the raw logic lives in `/logic`
- `/logic`: raw logic of the implant check-in (input, output, new session)
- `/schemas`: implant payload validation
- `/utils`: files with helper functions (crypto, body templates, metadata, logging)
