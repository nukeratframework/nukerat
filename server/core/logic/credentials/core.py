from logic.conclude_logic import conclude_request
from .logic import list_credentials, create_credentials, edit_credentials, delete_credentials


async def fetch_credentials():
    # Returns the final credentials response
    return await conclude_request(await list_credentials(), type="credentials")


async def create_credential(body: dict):
    # Returns the final response of a new credential
    return await conclude_request(await create_credentials(body), body=body, type="credentials")


async def patch_credential(tag: str, body: dict):
    # Returns the final response of a credential update
    return await conclude_request(await edit_credentials(tag, body), body=body, type="credentials")


async def remove_credential(tag: str):
    # Returns the final response of a credential delete
    return await conclude_request(await delete_credentials(tag), type="credentials")
