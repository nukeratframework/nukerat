import os


def resolve_path(root: str, rel: str) -> str | None:
    # Only sanitizes the path so it stays inside the root
    if "\x00" in (rel or ""):
        return None
    try:
        base = os.path.realpath(root)
        target = os.path.realpath(os.path.join(base, rel or ""))
    except OSError:
        return None
    try:
        if os.path.commonpath([base, target]) != base:
            return None
    except ValueError:
        return None
    return target
