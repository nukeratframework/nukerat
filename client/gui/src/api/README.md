# Overview

This is where the GUI talks to the team server. Each module wraps `fetch` for a route family; shared HTTP error text lives in `http_status.ts`.

## Directories

- `/system`: Login, stored server list, and key encode/decode helpers used before other calls
