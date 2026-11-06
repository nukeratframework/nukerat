# Overview

NukeScript syntax checks. Parses the script, checks the event bindings, then checks each command call. Shared arg checks live in `helpers.py`.

## Directories

- `/commands`: One validator per command (cmd, agent, db, network, etc.)
