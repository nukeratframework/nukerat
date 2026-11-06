# Overview

Raw logic of the launcher commands. start.py is where the team server actually boots (uvicorn, logging, clearing files in the tmp directory). The key, config, venv, and db files parse the command and call the helpers in `/utils`.
