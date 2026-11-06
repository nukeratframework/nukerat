import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
local = ("objects", "logic", "utils")


def shadows(entry: str) -> bool:
    # Checks if a path hides the worker packages
    path = Path(entry).resolve()
    if path == root:
        return False
    return any((path / name).is_dir() for name in local)


def clear_core_modules():
    # Removes cached worker modules from sys.modules
    for name in list(sys.modules):
        if name in local:
            del sys.modules[name]
        elif any(name.startswith(f"{n}.") for n in local):
            del sys.modules[name]


def activate():
    # Puts the worker root first on sys.path
    clear_core_modules()
    worker = str(root)
    sys.path[:] = [worker] + [p for p in sys.path if p != worker and not shadows(p)]