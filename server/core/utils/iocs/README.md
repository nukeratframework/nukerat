# Overview

IOC collection. Terminal command text and file server transfers get scanned here, then written to the IOC table. helpers.py is the write path (skips empty values and duplicates). core.py sends the body to the file server collector or the terminal collector.

## Directories

- `/endpoint`: where the collectors live (terminal commands, file server upload and download bytes)
- `/knowledge`: TLD and file extension lists used to tell a domain from a filename
