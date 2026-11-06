from logic.conclude_logic import conclude_request
from .manipulation import create_agent, update_agent, delete_agent, list_agents
from .usage import usage_agent


async def patch_agent(tag: str, body: dict):
    # Returns the final response of an agent update
    payload = {"tag": tag, "config": body.get("config") or body}
    return await conclude_request(await update_agent(payload), body=payload, type="agents")


async def remove_agent(tag: str):
    # Returns the final response of an agent delete
    payload = {"tag": tag}
    return await conclude_request(await delete_agent(payload), body=payload, type="agents")


async def fetch_agents():
    # Returns the final agents response
    return await conclude_request(await list_agents({}), type="agents")


async def main_agents(body: dict):
    # Routes the agent action to create or usage
    action = body.get("type")

    if action == "create":
        content = await create_agent(body)
    elif action == "usage":
        return await conclude_request(await usage_agent(body), body=body, type="agents")
    else:
        return await conclude_request(
            {"status": "failure", "message": "Invalid type"},
            status_code=400,
            body=body,
            type="agents",
        )

    return await conclude_request(content, body=body, type="agents")
