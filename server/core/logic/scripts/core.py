from logic.conclude_logic import conclude_request
from .logic import list_scripts, add_script, edit_script, delete_script, change_status


async def fetch_scripts():
    # Returns the final scripts response
    return await conclude_request(await list_scripts(), type="scripts")


async def create_script(body: dict):
    # Returns the final response of a new script
    return await conclude_request(await add_script(body), body=body, type="scripts")


async def patch_script(tag: str, body: dict):
    # Returns the final response of a script update
    payload = {"tag": tag, **body}
    if body.get("status") is not None:
        return await conclude_request(await change_status(payload), body=payload, type="scripts")
    return await conclude_request(await edit_script(payload), body=payload, type="scripts")


async def remove_script(tag: str, body: dict):
    # Returns the final response of a script delete
    payload = {"tag": tag, **body}
    return await conclude_request(await delete_script(payload), body=payload, type="scripts")
