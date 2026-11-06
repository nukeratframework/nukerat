# Overview

Shared stageless plumbing for Linux: globals, task dispatch, crypto transport, and channel-specific network code.

## Directories

- `/actions`: Host prep and fingerprint
- `/coffloader`: BOF-style COFF loader for Linux
- `/crypt`: C2 encryption and cipher utils
- `/general`: String formatters and beacon metadata JSON
- `/libs`: Small stdlib shims (HTTP)
- `/linapi`: POSIX helpers used across capabilities
- `/network`: HTTP core, TCP, relay packets, socks, portforward
- `/tasks`: Task registry, worker threads, output buffers
