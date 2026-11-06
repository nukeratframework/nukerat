from infra.database.database import Agents, AgentsHistory, sqlite_db


async def fail(msg):
    # Builds a failure pair for the usage check
    return None, {"status": "failure", "message": msg}


async def parse_usage(body):
    # Checks the usage fields and builds the payload
    chat_id = (body.get("id") or "").strip()
    message = (body.get("message") or "").strip()
    model = (body.get("model") or "").strip()
    if not model:
        return await fail("Model required")
    if not chat_id:
        return await fail("Chat id required")
    if not message:
        return await fail("Message required")
    return {
        "chat_id": chat_id,
        "message": message,
        "model": model,
        "context": body.get("context") or [],
        "system_prompt": (body.get("system_prompt") or "").strip(),
        "use_full_context": bool(body.get("use_full_context")),
    }, None


async def find_agent(name):
    # Finds the agent by name
    rows = await sqlite_db.read(Agents, name=name)
    if not rows:
        return await fail("Model not found")
    return rows[0], None


async def build_messages(data):
    # Builds the message list for the agent
    messages = []
    if data["system_prompt"]:
        messages.append({"role": "system", "content": data["system_prompt"]})
    if data["context"]:
        messages.extend(data["context"])
    if data["use_full_context"]:
        rows = sorted(await sqlite_db.read(AgentsHistory, chat_id=data["chat_id"]), key=lambda r: r.id)
        messages.extend({"role": r.role, "content": r.content} for r in rows)
    messages.append({"role": "user", "content": data["message"]})
    return messages, None


async def mask_api_key(key: str) -> str:
    # Hides the middle of the api key
    if not key or len(key) <= 8:
        return "*" * len(key)
    visible = 4
    return key[:visible] + "*" * (len(key) - visible * 2) + key[-visible:]