# Overview

Folder and file reads on a host. A file request queues a `folders` task and waits for the bytes in `infra/tmp`. The folder tree comes from the stored rows, and a refresh is queued when autoRefresh is set.
