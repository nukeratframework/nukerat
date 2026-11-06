import json
from pathlib import Path

root = Path(__file__).resolve().parent / "json"

with (root / "top_level_domains.json").open(encoding="utf-8") as file:
    tlds = {
        str(item).strip().lower().lstrip(".")
        for item in json.load(file)
        if str(item).strip()
    }

with (root / "file_extensions.json").open(encoding="utf-8") as file:
    extensions = {
        part.strip().lower().lstrip(".")
        for item in json.load(file)
        for part in str(item).split(",")
        if part.strip() and "..." not in part
    }

def is_valid_domain(candidate: str) -> bool:
    # Checks if the candidate is a real domain and not a file name
    value = candidate.strip().lower()
    if not value or "." not in value:
        return False

    parts = [part for part in value.split(".") if part]
    if len(parts) < 2 or parts[-1] in extensions:
        return False

    for index in range(len(parts)):
        if ".".join(parts[index:]) in tlds:
            return True

    return False
