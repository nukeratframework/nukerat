# Overview

Shared loader utilities for the Linux stager: build-time globals, pulling the next stage, and the small helpers the loader routine uses before stageless code runs.

## Directories

- `/actions`: Host prep before the loader talks to C2
- `/crypt`: Transport decryption and cipher helpers for the loader channel
- `/linapi`: POSIX-facing handlers (shared library load for the stage payload)
- `/network`: HTTP client used to fetch the stage
