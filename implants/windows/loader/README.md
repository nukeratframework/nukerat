# Overview

Windows loader. `main.nim` runs the preface, then the channel routine.

## Directories

- `/capabilities`: AMSI/ETW/PE patches and sleep masking
- `/routine`: HTTP or custom channel entry
- `/utils`: Globals, crypt, network, winapi, and stage prep
