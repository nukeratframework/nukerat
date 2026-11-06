from logic.conclude_logic import conclude_request
from .build import main as build


async def main_implants(body):
    # Returns the final implant build response
    result = await build(body)
    status_code = 400 if result.get("status") == "failure" and "stdout" not in result else 200
    return await conclude_request(result, body=body, type="implants", status_code=status_code)
