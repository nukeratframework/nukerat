# Overview

All logic around listeners (file serve included). Listeners are the services exposed by the team server. `profile.py` is the shared endpoint path and response-header middleware.

## Directories

- `/http`: HTTP listener the implants check in on
- `/file_server`: file serve listener
- `/socks`: SOCKS and proxychains listener
- `/port_forward`: port forwarding listener
