# Overview

Linux stageless implant: entry in `main.nim`, build macros, and the channel loop that keeps talking to the team server.

## Directories

- `/capabilities`: Task handlers (files, relay, shell, port scan, etc.)
- `/routine`: HTTP, TCP, and custom channel entrypoints
- `/utils`: Globals, crypto, network, tasks, COFF loader, linapi
