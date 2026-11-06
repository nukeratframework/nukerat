# Overview

File serve listener. `manage.py` starts it, restores `file_server` rows from the database, and drops content folders that no longer have a listener.

## Directories

- `/routes`: the app that serves the files
- `/utils`: files with helper functions (path check, request log)
