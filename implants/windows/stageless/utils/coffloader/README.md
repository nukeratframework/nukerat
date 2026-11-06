# Overview

In-process COFF/BOF loader for Windows. Validates the object, maps sections, resolves symbols, and runs the entry with optional BOF args.

## Directories

- `/lib`: Low-level COFF pieces (parse, relocations, memory, beacon I/O, etc.)
- `loader.nim` / `nimcoff.nim`: Orchestration and exports used by execution capabilities
