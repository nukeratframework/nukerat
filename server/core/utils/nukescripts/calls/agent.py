import asyncio

from infra.database.database import Agents, sqlite_db
from logic.agents.utills.preset import call_deepseek
from logic.agents.utills.custom import call_custom

main_loop = None


async def send_agent(agent_tag, prompt):
    # Sends the prompt to the agent and returns the reply
    rows = await sqlite_db.read(Agents, tag=agent_tag.strip())
    if not rows:
        return "Agent not found"
    agent = rows[0]
    messages = [{"role": "user", "content": str(prompt)}]
    if agent.type == "deepseek":
        reply, err = await call_deepseek(agent.api_key, messages)
    elif agent.type == "custom":
        reply, err = await call_custom(agent, messages)
    else:
        return "Unknown model type"
    return err or reply


def dispatch_agent(agent_tag, prompt):
    # Runs the agent call on the main loop
    future = asyncio.run_coroutine_threadsafe(send_agent(agent_tag, prompt), main_loop)
    return future.result()
