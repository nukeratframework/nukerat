# Overview

Raw logic of the team server routes (this is where the server entrypoint points). Response wrapping lives in `conclude_logic.py`.

## Directories

- `/aes`: AES key creation
- `/agents`: Agent records and the calls that talk to them (deepseek, custom, etc.)
- `/auth`: Login check and JWT creation
- `/credentials`: Credential records (list, create, edit, delete)
- `/explorer`: Folder and file reads on a host
- `/file_server`: Files sitting in a file server listener
- `/implants`: Implant build logic
- `/iocs`: IOC listing and removal
- `/keylogger`: Keylogger records
- `/listeners`: HTTP and file server listener logic
- `/logs`: Reading `server.log` and `listeners.log`
- `/network`: SOCKS and port forwarding
- `/notifications`: New host notifications
- `/ns_output`: NukeScript output long poll
- `/process`: Process tree requests
- `/queue`: Task queue listing
- `/reports`: Report files (activity, hosts, ioc)
- `/screenshot`: Screenshot snapshots from `infra/tmp`
- `/scripts`: NukeScript records and syntax checks
- `/sessions`: Host session listing and the relay graph
- `/terminal`: Terminal command logic
- `/utils`: Client disconnect watcher
