# Overview

macOS staging loader. Fetches and runs the next stage (shared library via `utils/stage` and macapi), with HTTP or custom C2 loops under `/routine`.

## Directories

- `/capabilities`: Loader-only capabilities (sleep, etc.)
- `/routine`: Channel entry (`start`, `http`, `custom`)
- `/utils`: Globals, crypto transport, network, macapi, obfuscation, staging helpers
