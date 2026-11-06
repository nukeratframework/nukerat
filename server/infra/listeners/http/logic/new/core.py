from ipaddress import ip_address
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def main_new(content, config, request=None):
    # Registers a new host and records a public external IP
    try:
        origin_ip = request.client.host if request and request.client else ""
        content["external_ip"] = ""

        try:
            if origin_ip and ip_address(origin_ip.strip()).is_global:
                content["external_ip"] = origin_ip
        except ValueError:
            pass

        return await listener_utils.add_host(content)
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http/new | {e}")
        return {"status": "failure", "error": str(e)}
