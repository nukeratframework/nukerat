import asyncio
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from logic.conclude_logic import conclude_request
from middlewares.jwt import jwt_algorithm, jwt_expire_minutes, jwt_secret
from infra.database.database import User, sqlite_db


async def main_auth(body):
    # Checks the operator and returns a jwt
    username = str(body.get("user") or body.get("username") or "").strip()
    password = body.get("pass") or body.get("password")
    secret = str(body.get("secret") or "").strip()

    if not username or not password or not secret:
        return await conclude_request(
            {"status": "failure", "message": "user, pass and secret are required"},
            body=body,
            type="auth",
        )

    users = await sqlite_db.read(User, user=username)
    if not users or users[0].secret != secret:
        return await conclude_request(
            {"status": "failure", "message": "Invalid credentials"},
            body=body,
            type="auth",
        )

    stored = users[0]
    pwd_bytes = str(password).encode("utf-8")
    hash_bytes = stored.password_hash.encode("utf-8")
    try:
        valid = await asyncio.to_thread(bcrypt.checkpw, pwd_bytes, hash_bytes)
    except ValueError:
        valid = False

    if not valid:
        return await conclude_request(
            {"status": "failure", "message": "Invalid credentials"},
            body=body,
            type="auth",
        )

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": stored.user,
            "uid": stored.id,
            "iat": now,
            "exp": now + timedelta(minutes=jwt_expire_minutes),
        },
        jwt_secret,
        algorithm=jwt_algorithm,
    )

    return await conclude_request(
        {"status": "success", "access_token": token},
        body=body,
        type="auth",
    )
