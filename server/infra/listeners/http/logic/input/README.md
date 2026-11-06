# Overview

Logic that runs when the implant asks for queued commands. `core.py` loads the pending queue, runs the content handlers, and marks the tasks captured.

## Directories

- `/capabilities`: content handlers that fill the command body before it goes back to the implant (bof, shellcode, donut, upload, etc.)
