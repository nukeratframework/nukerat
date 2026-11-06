# Overview

Windows stageless implant: `main.nim` entry (EXE or DLL-safe thread spawn), build macros, and the routine that picks HTTP, TCP, SMB, or custom C2.

## Directories

- `/capabilities`: Task handlers (execution, injection, relay, tokens, etc.)
- `/routine`: Channel loops (http, tcp, smb, custom)
- `/utils`: Globals, winapi, crypto, COFF loader, network, tasks
