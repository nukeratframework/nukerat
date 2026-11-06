# Overview

In-process ELF/BOF loader for Linux. Validates the object, maps sections, resolves symbols, and runs the entry (default `go`) with optional BOF args.

## Directories

- `/lib`: Low-level ELF pieces (parse, relocations, memory, beacon I/O, etc.)
- `loader.nim` / `nimcoff.nim`: Orchestration and exports consumed by execution capabilities
