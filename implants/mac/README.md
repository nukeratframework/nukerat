# Overview

macOS agent code in Go. Loader and stageless trees mirror the other platforms; build tags and obfuscated strings are wired through `utils/obf` and `utils/global`.

## Directories

- `/loader`: Staging loader (`main.go` runs `Custom` then `routine.MainInit`)
- `/stageless`: Full implant with exported `StartW` for dylib-style builds
