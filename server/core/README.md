# Overview

Main server logic.

## Directories

- `/logic`: Raw logic of the team server routes (this is where the server entrypoint points)
- `/middlewares`: JWT verification middlewares
- `/routes`: Route entrypoints, the raw logic lives in `/logic`
- `/schemas`: Client input validation schemas
- `/utils`: Various logic, such as:
    - IOC collection
    - Help messages (armory, lolbins, etc)
    - Logic around NukeScript validation
