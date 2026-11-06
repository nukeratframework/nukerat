# Overview

Where the implant compile logic lives. `core.py` picks the format (exe, dll, shellcode, elf, so, app). Sandbox wrapping for the compiler is in `sandbox.py`, file reads in `blocking_io.py`.

## Directories

- `/go`: Go compile path (the `app` format)
- `/nim`: Nim compile path (exe, dll, shellcode, elf, so)
- `/modules`: Extra pieces used by a compile, such as junkcode
