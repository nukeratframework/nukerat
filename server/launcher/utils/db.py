import os
from pathlib import Path
from infra.database.database import sqlite_db_sync as sqlite_db


def db_usage():
    # Prints the database path and the size of each table
    db_path = sqlite_db.database_path()

    if not db_path.is_file():
        print(f"Database not found: {db_path}")

        return 1

    total = db_path.stat().st_size

    for suffix in ("-wal", "-shm"):
        sidecar = Path(str(db_path) + suffix)

        if sidecar.is_file():
            total += sidecar.stat().st_size
    print(db_path)
    sqlite_db.start()

    try:
        table_sizes = sqlite_db.table_sizes()
    except Exception as exc:
        print(f"Error reading database: {exc}")

        return 1
    table_sizes.sort(key=lambda row: (-row[1], row[0]))
    rows = [("total", total)] + table_sizes
    formatted = []

    for label, n in rows:
        if n < 1024:
            formatted.append((label, f"{n} B"))
            continue

        v = float(n)

        for unit in ("KB", "MB", "GB", "TB"):
            v /= 1024

            if v < 1024 or unit == "TB":
                formatted.append((label, f"{v:.2f} {unit}"))
                break
    name_width = max(len(label) for label, _ in formatted)

    for label, size in formatted:
        print(f"{label.ljust(name_width)}  {size}")

    return 0

def db_export(dest):
    # Exports the database to the given path
    db_path = sqlite_db.database_path()

    if not db_path.is_file():
        print(f"Database not found: {db_path}")

        return 1

    if not dest or not str(dest).strip():
        print("Error: export path is required")

        return 1

    dest_path = str(dest).strip()

    if dest_path.startswith('"') and dest_path.endswith('"'):
        dest_path = dest_path[1:-1]
    elif dest_path.startswith("'") and dest_path.endswith("'"):
        dest_path = dest_path[1:-1]

    out = Path(dest_path).expanduser()

    if not out.exists():
        parent = out.parent

        if not parent.exists():
            try:
                parent.mkdir(parents=True, exist_ok=True)
            except OSError as exc:
                print(f"Error: cannot create directory ({parent}): {exc}")

                return 1
    elif out.is_dir():
        print(f"Error: export path is a directory ({out})")

        return 1

    try:
        out = out.resolve()
    except OSError as exc:
        print(f"Error: invalid export path ({exc})")

        return 1
    parent = out.parent

    if not parent.is_dir():
        print(f"Error: export directory not found ({parent})")

        return 1

    if not os.access(parent, os.W_OK):
        print(f"Error: export directory is not writable ({parent})")

        return 1

    if out.is_file() and not os.access(out, os.W_OK):
        print(f"Error: export file is not writable ({out})")

        return 1

    sqlite_db.start()

    try:
        sqlite_db.export_to(out)
    except Exception as exc:
        print(f"Error exporting database: {exc}")

        return 1
    print(f"Database exported to {out}")

    return 0

def db_import(src):
    # Receives the file path and replaces the current database
    db_path = sqlite_db.database_path()

    if not src or not str(src).strip():
        print("Error: import file path is required")

        return 1

    src_path = str(src).strip()

    if src_path.startswith('"') and src_path.endswith('"'):
        src_path = src_path[1:-1]
    elif src_path.startswith("'") and src_path.endswith("'"):
        src_path = src_path[1:-1]

    incoming = Path(src_path).expanduser()

    if not incoming.exists():
        print(f"Error: path not found ({incoming})")

        return 1

    if incoming.is_dir():
        print(f"Error: path is a directory ({incoming})")

        return 1

    if not incoming.is_file():
        print(f"Error: not a file ({incoming})")

        return 1

    try:
        incoming = incoming.resolve()
    except OSError as exc:
        print(f"Error: invalid import path ({exc})")

        return 1

    if not os.access(incoming, os.R_OK):
        print(f"Error: file is not readable ({incoming})")

        return 1

    err = sqlite_db.check_sqlite_file(incoming)

    if err:
        print(f"Error: not a valid SQLite database ({err})")

        return 1

    dest_parent = db_path.expanduser().parent

    if dest_parent.exists() and not os.access(dest_parent, os.W_OK):
        print(f"Error: database directory is not writable ({dest_parent})")

        return 1

    print(f"This will replace the current database at {db_path}")
    answer = input(f"Import from {incoming}? [y/N]: ").strip().lower()

    if answer not in ("y", "yes"):
        print("Cancelled.")

        return 0

    dest_parent.mkdir(parents=True, exist_ok=True)
    sqlite_db.start()

    try:
        sqlite_db.import_from(incoming)
    except Exception as exc:
        print(f"Error importing database: {exc}")

        return 1
    print(f"Database imported from {incoming}")

    return 0
