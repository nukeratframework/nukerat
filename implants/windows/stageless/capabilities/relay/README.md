# Overview

Relay worker registry and forwarding for Windows stageless. `core` owns relay state and locks; `frame`, `http`, `http_custom`, `tcp`, and `smb` implement per-channel relay I/O.
