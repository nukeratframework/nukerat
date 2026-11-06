import secrets
import string
from pathlib import Path
import bcrypt
from infra.database.database import User, sqlite_db_sync as sqlite_db


def key_add(name):
    # Creates the operator, stores the hash in the DB and writes the key file
    base = name.strip()

    if not base:
        print("Username is required")

        return

    if "/" in base or "\\" in base or base in (".", ".."):
        print("Invalid name")

        return

    folder = Path.cwd()
    index = 0

    while True:
        username = base if index == 0 else f"{base}({index})"

        if len(username) > 150:
            print("Name must be less than 150 characters")

            return

        if not sqlite_db.read(User, user=username) and not (folder / f"{username}.key").exists():
            break

        index += 1
    pool = string.ascii_letters + string.digits
    password = "".join(secrets.choice(pool) for _ in range(23))
    secret = "".join(secrets.choice(pool) for _ in range(256))
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    sqlite_db.write(
        User(
            user=username,
            password_hash=password_hash,
            secret=secret,
        )
    )
    path = folder / f"{username}.key"
    path.write_text(f"{username}:{password}:{secret}\n", encoding="utf-8")
    print(f"{username}:{password}:{secret}")
    print(f"\nOperator created successfully: {username}")
    print(f"Saved: {path}")

def key_list():
    # Prints the operators stored in the DB
    rows = sqlite_db.read(User)

    if not rows:
        print("No operators")

        return

    for row in rows:
        print(f"{row.user}  (id={row.id})")

def key_rem(name):
    # Removes the operator from the DB
    username = name.strip()

    if sqlite_db.delete(User, user=username) == 0:
        print(f"User not found: {username}")

        return

    print(f"Operator revoked: {username}")
