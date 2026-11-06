# Overview

Task-facing command implementations for the Windows stageless implant. Top-level `.nim` files cover filesystem, process, and network ops; heavier flows sit in subfolders and are wired from `modes.nim`.

## Directories

- `/execution`: Shellcode, .NET, and DLL run helpers
- `/injection`: Remote inject and allocation modes
- `/keylogger`: Keyboard capture worker
- `/lolbins`: Trusted-binary execution wrappers
- `/portscan`: Port scan worker
- `/relay`: Relay registry plus HTTP, TCP, and SMB paths
- `/sleep`: Masked sleep for the beacon loop
- `/system`: Getsystem-style privilege paths
- `/tokens`: Token manipulation helpers
