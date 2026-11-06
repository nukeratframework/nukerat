from pathlib import Path


def read_message(path):
    # Reads a help message file
    p = Path(__file__).resolve().parents[3] / "utils" / "messages" / path
    return p.read_text(encoding="utf-8") if p.is_file() else None
