from launcher.utils.config import (
    cell_unit_scale,
    config,
    default_cell_amount,
    default_cell_unit,
)


def cell_byte_limit():
    # Returns the max cell size in bytes
    fallback = default_cell_amount * cell_unit_scale[default_cell_unit]
    try:
        return max(0, int(config.get("database", {}).get("max_cell_value_bytes", fallback)))
    except (TypeError, ValueError):
        return fallback


def clamp_cell_value(value):
    # Cuts a string so it fits the max cell size
    if not isinstance(value, str):
        return value
    n = cell_byte_limit()
    if n <= 0:
        return value
    raw = value.encode("utf-8")
    if len(raw) <= n:
        return value
    return raw[:n].decode("utf-8", errors="ignore")
