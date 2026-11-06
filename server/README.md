# Overview

Root of the team server directory.

## Directories

- `/core`:
    - FastAPI route entry point
    - Raw logic of all routes
    - Middlewares
    - Route schemas
    - Mensagens de help
- `/infra`:
    - Binaries (armory, migration shellcodes)
    - TLS certificates
    - Database: file and shared connection layer
    - All listener logic (listeners are the services exposed by the team server)
    - Report files
    - Temporary files directory
    - Golang toolchain (for building binaries)
- `/launcher`: Logic that runs before the server starts, including help-command handling
- `/logs`: Server log files
- `/venv`: Python virtual environment for the whole project
- `/workers`: NukeScript worker, which runs on its own thread