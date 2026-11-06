import asyncio
import json
from urllib.parse import unquote

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from infra.general.create_log import logger, write_log
from logic.terminal.core import main_session_commands
from schemas.terminal import TerminalRequest

router = APIRouter()


@router.post("/")
async def root(request: Request):
    # Entrypoint that receives the terminal command and runs it
    try:
        # Upload request =========================================================
        
        meta = request.headers.get("x-terminal-meta")
        if meta:
            data = json.loads(unquote(meta))
            raw = await request.body()
            payload = await asyncio.to_thread(
                lambda: TerminalRequest.model_validate(data).model_dump(exclude_none=True, by_alias=True)
            )
            if raw:
                payload["__tmp_file_bytes__"] = raw
        
        # Normal request ==========================================================

        else:
            raw = await request.body()
            payload = await asyncio.to_thread(
                lambda b: TerminalRequest.model_validate(json.loads(b)).model_dump(
                    exclude_none=True, by_alias=True
                ),
                raw,
            )
        return await main_session_commands(payload, request=request)

    # Exceptions ===================================================================
    
    except ValidationError as e:
        return JSONResponse(status_code=422, content={"detail": e.errors()})
    except json.JSONDecodeError:
        return JSONResponse(status_code=422, content={"detail": "Invalid JSON"})
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )
