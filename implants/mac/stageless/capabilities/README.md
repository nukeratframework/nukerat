# Overview

Operator task entrypoints for macOS stageless. Go files here implement download, shell, process, relay, socks, and related commands; `modes.go` maps task names to handlers and filters Windows-only names.

## Directories

- `/portscan`: Port scan core and helpers
- `/relay`: Relay HTTP/TCP/frame logic shared with other platforms
