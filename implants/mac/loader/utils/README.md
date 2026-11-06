# Overview

Shared helpers for the mac loader: build placeholders in `global`, C2 HTTP, crypto transport, and Darwin API wrappers.

## Directories

- `/actions`: Pre-main prep hooks
- `/crypt`: AES transport wrap/unwrap for loader traffic
- `/macapi`: macOS syscall and handler shims
- `/network`: HTTP core for the loader channel
- `/obf`: String obfuscation helpers
- `/stage`: Runs the staged payload via `RunStageApp`
