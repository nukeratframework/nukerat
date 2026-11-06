from logic.conclude_logic import conclude_request
from .logic import new_hosts


async def fetch_notifications(request=None):
    # Returns the final notifications response
    return await conclude_request(await new_hosts(request), type="notifications")
