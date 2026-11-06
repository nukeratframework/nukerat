# Overview

Logic that runs the NukeScript worker from the team server. This is where start_worker lives: it starts the worker thread and points each NukeScript function at a call in `/calls`, so those calls run back on the server loop.

## Directories

- `/calls`: the calls the worker makes back into the server (commands, explorer, process list, screenshot, file server, network, agents)
