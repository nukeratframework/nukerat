import jwt
from jwt.exceptions import InvalidTokenError
from fastapi.responses import JSONResponse
from launcher.utils.config import config
from starlette.requests import Request
from infra.database.database import User, sqlite_db

_cfg = config.get("config") or {}
jwt_secret = _cfg.get("jwt_secret") or ""
jwt_expire_minutes = int(_cfg.get("jwt_expire_minutes") or 10080)
jwt_algorithm = "HS256"


async def jwt_middleware(request: Request, call_next):
    # Middleware to verify the JWT
    if request.method == "OPTIONS" or request.url.path == "/auth/login":
        return await call_next(request)

    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.startswith("Bearer ") else ""
    try:
        if not token:
            raise InvalidTokenError
        payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
        sub = str(payload.get("sub") or "").strip()
        if not sub or not await sqlite_db.read(User, user=sub):
            raise InvalidTokenError
    except InvalidTokenError:
        return JSONResponse(
            status_code=401,
            content={"status": "failure", "message": "Expired session"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await call_next(request)
