# Overview

Folder for the sqlite DB file (`database.db`) and the shared connection layer. `init.sql` is the schema the installer loads, `database.py` is the models plus the async/sync access (`sqlite_db`), `listener_utils.py` is the DB access the listener threads use, and `cell_limits.py` clamps text cells to the configured size.
