import httpx

from infra.general.create_log import logger, write_log


async def call_deepseek(api_key, messages):
    # Sends the messages to deepseek
    if not api_key:
        return None, "API key required"
    try:
        async with httpx.AsyncClient(timeout=999999) as client:
            r = await client.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                json={"model": "deepseek-v4-pro", "messages": messages, "stream": False},
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
            if not text:
                return None, "Empty response"
            return text, None
    except httpx.HTTPError as e:
        write_log(logger, "error", f"Unhandled exception | agents/preset | {e}")
        return None, f"Request failed: {e}"
    except (KeyError, IndexError, TypeError) as e:
        write_log(logger, "error", f"Unhandled exception | agents/preset | {e}")
        return None, "Invalid response"
