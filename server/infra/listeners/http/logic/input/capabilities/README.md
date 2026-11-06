# Overview

Content handlers for queued commands. `custom.py` picks the handler (bof, shellcode, migrate, donut, dll, upload, etc.), `get_content.py` is where the file bytes are read and encoded, and `actions.py` marks a terminate task completed.
