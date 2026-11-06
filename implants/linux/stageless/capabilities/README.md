# Overview

Task handlers for the Linux stageless implant. Top-level modules cover filesystem, process, shell, relay, socks, portforward, and similar operator commands; `modes.nim` wires names to these entrypoints.

## Directories

- `/portscan`: Port scan task logic
- `/relay`: HTTP/TCP relay framing and custom listener hooks
