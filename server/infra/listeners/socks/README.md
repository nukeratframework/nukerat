# Overview

SOCKS and proxychains listener. `manage.py` starts the pproxy server and restores those rows from the database, `streams.py` is the beacon-backed connection, and `queue_bridge.py` is the queue the proxy uses to talk to the implant.
