# Overview

Linux stager that runs build-time prep, then hands off to an HTTP or custom C2 routine.

## Directories

- `/capabilities`: Loader-only extras such as sleep masking
- `/routine`: Channel entrypoints (`start` picks HTTP vs custom)
- `/utils`: Shared loader logic (staging, crypto, linapi, network)
