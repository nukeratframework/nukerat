# Overview

Linux agent code in Nim. Build-time placeholders in `global` and `custom` get filled when the server compiles the implant.

## Directories

- `/loader`: First-stage binary that talks to C2, then runs the staged payload
- `/stageless`: Full implant (`main.nim` exports `StartW` for shared-library builds)
