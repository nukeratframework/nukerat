import json
import httpx

from infra.general.create_log import logger, write_log


async def call_custom(agent, messages):
    # Sends the messages to a custom endpoint
    if not agent.endpoint:
        return None, "Endpoint required"
    try:
        headers = {h["key"]: h["value"] for h in json.loads(agent.headers or "[]")}
        body = json.loads(agent.body_template or "{}")
        template_messages = body.get("messages", [])
        runtime_system = next((m for m in messages if m.get("role") == "system"), None)
        runtime_others = [m for m in messages if m.get("role") != "system"]
        system_idx = next(
            (i for i, m in enumerate(template_messages) if m.get("role") == "system"),
            None,
        )
        if runtime_system:
            if system_idx is not None:
                template_messages[system_idx] = runtime_system
            else:
                template_messages.insert(0, runtime_system)
        body["messages"] = template_messages + runtime_others
        async with httpx.AsyncClient(timeout=999999, verify=False) as client:
            r = await client.post(agent.endpoint, headers=headers, json=body)
            r.raise_for_status()
            cur = r.json()
            for segment in (agent.response_field or "").split("."):
                if not segment:
                    continue
                key, index = None, None
                if "[" in segment:
                    key, _, rest = segment.partition("[")
                    index = int(rest.rstrip("]"))
                else:
                    key = segment
                if key is not None:
                    if isinstance(cur, dict):
                        cur = cur[key]
                    else:
                        for item in cur:
                            if isinstance(item, dict) and key in item:
                                cur = item[key]
                                break
                        else:
                            raise KeyError(key)
                if index is not None:
                    cur = cur[index]
            if cur is None:
                return None, "Response field not found"
            return str(cur), None
    except httpx.HTTPError as e:
        write_log(logger, "error", f"Unhandled exception | agents/custom | {e}")
        return None, f"Request failed: {e}"
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as e:
        write_log(logger, "error", f"Unhandled exception | agents/custom | {e}")
        return None, "Invalid response"
