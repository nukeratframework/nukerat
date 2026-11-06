from logic.conclude_logic import conclude_request
from .logic import read_screenshot


async def fetch_screenshot(tag: str, query: dict, request=None):
    # Returns the final screenshot response
    return await conclude_request(
        await read_screenshot(tag, query.get("hash"), query.get("long_polling", False), request),
        type="screenshot",
    )
