# Overview

All logic around HTTP and file server listeners (create, restart, list, remove). `config.py` is just the long polling flag. Port parsing and the HTTP path live in `http.py`, the file server path in `file_server.py`.

## Directories

- `/certs`: Certificate checks and the openssl self-signed path
