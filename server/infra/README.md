# Overview

Infra is where everything that isn't related to the server's core logic lives, such as: armory binaries, listener logic, etc.

## Directories

- `/bin`: Where the compiled armory binaries live
- `/certs`: Where the TLS certificates live
- `/database`: Folder for the sqlite DB file
- `/general`:  Just the server log creation logic
- `/listeners`: All logic around listeners (file serve included)
- `/reports`: Where the report files live
- `/tmp`: Folder the team server uses as a temporary directory
