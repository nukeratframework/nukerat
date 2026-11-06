from fastapi.responses import JSONResponse
from utils.querys import create_agent_history_line
from .utills.validation import parse_usage, find_agent, build_messages
from .utills.preset import call_deepseek
from .utills.custom import call_custom


async def usage_agent(body: dict):
    # Sends the prompt to the agent and stores the reply
    data, err = await parse_usage(body)
    if err:
        return JSONResponse(content=err)

    agent, err = await find_agent(data["model"])
    if err:
        return JSONResponse(content=err)

    messages, err = await build_messages(data)
    if err:
        return JSONResponse(content=err)

    if agent.type == "deepseek":
        reply, err = await call_deepseek(agent.api_key, messages)
    elif agent.type == "custom":
        reply, err = await call_custom(agent, messages)
    else:
        return JSONResponse(content={"status": "failure", "message": "Unknown model type"})

    if err:
        return JSONResponse(content={"status": "failure", "message": err})

    await create_agent_history_line(data["chat_id"], "user", data["message"])
    await create_agent_history_line(data["chat_id"], "assistant", reply)

    return JSONResponse(content={"status": "success", "agent_response": reply})
