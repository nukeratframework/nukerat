import json
import os
from pathlib import Path

from fastapi.responses import JSONResponse
from infra.database.database import Builds, Host, sqlite_db
from logic.conclude_logic import conclude_request


def needs_host(verb):
    # Checks if the command needs a host
    if verb in ("help", "armory"):
        return False
    if verb.startswith("armory "):
        return False
    if verb in ("download list", "download delete"):
        return False
    return True


def reply(status, message, source_terminal=None, **extra):
    # Builds the terminal json response
    content = {"status": status, "message": message}
    if source_terminal is not None:
        content["source_terminal"] = source_terminal
    content.update(extra)
    return JSONResponse(status_code=200, content=content)


async def done(body, resp):
    # Returns the final terminal response
    return await conclude_request(resp, body=body, type="terminal")


async def ok(body, message, source_terminal=None, **extra):
    # Returns a success terminal response
    return await done(body, reply("success", message, source_terminal, **extra))


async def fail(body, message, source_terminal=None, **extra):
    # Returns a failure terminal response
    return await done(body, reply("failure", message, source_terminal, **extra))