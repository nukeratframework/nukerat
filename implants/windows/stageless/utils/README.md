# Overview

Shared stageless plumbing: globals, task buffers, crypto transport, COFF loader, and channel-specific network code.

## Directories

- `/actions`: Host prep and fingerprint
- `/coffloader`: BOF loader (Windows COFF)
- `/crypt`: C2 encryption and cipher utils
- `/debug`: Placeholder for debug artifacts
- `/general`: Strings, metadata, encoding
- `/network`: HTTP, TCP, SMB, socks, portforward, relay packets
- `/tasks`: Task queue, threads, buffers
- `/winapi`: Indirect syscalls, handlers, stubs
