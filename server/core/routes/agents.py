from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from infra.general.create_log import logger, write_log
from core.logic.agents.core import fetch_agents, main_agents, patch_agent, remove_agent
from schemas.agents import AgentRequest, AgentTag, PatchAgentRequest

router = APIRouter()


@router.get("/")
async def list_agents(request: Request):
    # Entrypoint that lists the agents
    try:
        return await fetch_agents()
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.post("/")
async def root(request: Request, body: AgentRequest):
    # Entrypoint that creates an agent or sends a prompt
    try:
        return await main_agents(body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.patch("/{tag}")
async def patch(request: Request, tag: AgentTag, body: PatchAgentRequest):
    # Entrypoint that updates an agent
    try:
        return await patch_agent(tag, body.model_dump())
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )


@router.delete("/{tag}")
async def delete(request: Request, tag: AgentTag):
    # Entrypoint that deletes an agent
    try:
        return await remove_agent(tag)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | {request.method} {request.url.path} | {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "failure", "message": "Internal error"},
        )