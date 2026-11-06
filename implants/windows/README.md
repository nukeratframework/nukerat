# Overview

Windows agent code in Nim. Loader is a thin stager; stageless adds SMB/TCP/HTTP/custom routines, indirect syscalls, and the full capability set.

## Directories

- `/loader`: First stage (`main.nim`, optional dllsafe entry)
- `/stageless`: Full implant with Win32/NT helpers under `/utils/winapi`
