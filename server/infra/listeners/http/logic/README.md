# Overview

Raw logic of the HTTP listener check-in. `core.py` logs the check-in and marks the host active, `actions.py` splits the payload into input, output, new session, task error, or kill.

## Directories

- `/input`: logic that runs when the implant asks for queued commands
- `/output`: logic that runs when the implant returns task output
- `/new`: logic that runs when a new session checks in
