from fastapi.responses import StreamingResponse

from infra.general.create_log import logger, write_log
from logic.conclude_logic import conclude_request
from utils.iocs.endpoint.terminal import run as terminal_iocs_run

from .mapping import chunked_response, fire_and_forget, return_help
from .utils.armory import main_armory
from .utils.command import build_command, compat_error, enqueue, help_text, parse_command
from .utils.general import done, fail, needs_host, ok
from .utils.lolbins import create_lolbins_check_command, expand_lolbin_command, should_expand_lolbin_command
from .utils.download import download_queue_create, handle_download_queue_command
from .utils.parse_args import remove_blob_payload_tmp
from .utils.wait import wait_download_response, wait_response


async def main_session_commands(body, request=None):
    # Main function that runs a terminal command
    try:
        try:
            await terminal_iocs_run(body)
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | terminal/iocs | {e}")

        input, background, verb, cmd_id = parse_command(body)
        source_terminal = body.get("source_terminal")
        host_tag = body.get("host_tag")

        msg = await compat_error(host_tag, verb, cmd_id)
        if msg:
            return await fail(body, msg, source_terminal)

        # =============================================================================

        if should_expand_lolbin_command(input):
            expanded = expand_lolbin_command(input)
            if expanded:
                body["command"] = expanded
                input, background, verb, cmd_id = parse_command(body)

        # =============================================================================

        if verb == "lolbins check":
            pack = create_lolbins_check_command(input)
            if not pack:
                return await fail(
                    body, "lolbins check requires <tag> (download, execute, etc)", source_terminal,)
            body["command"] = pack["command"]
            body["lolbins_check_bins"] = pack["bins_path"]
            input, background, verb, cmd_id = parse_command(body)
           
        # =============================================================================

        if verb in ("help", "armory", "lolbins", "rat"):
            return await ok(body, await help_text(input, verb))

        if verb in ("download list", "download delete"):
            return await done(body, await handle_download_queue_command(input, verb, source_terminal))

        if verb in return_help and input.strip() == verb:
            return await ok(body, await help_text(f"help {verb}", "help"))

        if verb in ("armory install", "armory install all", "armory update", "armory remove"):
            return await done(body, await main_armory(verb, input, source_terminal))

        if needs_host(verb) and not host_tag:
            return await fail(body, "Host is required", source_terminal)

        if not cmd_id:
            return await fail(body, f"Unknown command: {input}")

        # =============================================================================

        command, params, err = await build_command(
            input, cmd_id, source_terminal, body.get("__tmp_file_bytes__")
        )
        if err:
            return await fail(body, err, source_terminal)

        if body.get("lolbins_check_bins"):
            params["bins_path"] = body["lolbins_check_bins"]

        download_id = body.get("download_id") if command in chunked_response else None
        if download_id:
            params["download_id"] = download_id

        queue_command, _ = remove_blob_payload_tmp(body.get("command", ""))
        cmd_tag = await enqueue(host_tag, command, params, queue_command)

        if background:
            return await ok(body, "Successfully executed in background.", source_terminal)
        
        # =============================================================================
        # Mode 01 > Fire and Forget
        if command in fire_and_forget:
            return await ok(body, fire_and_forget[command], source_terminal)
        # Mode 02 > chunked download
        elif command in chunked_response:
            if download_id:
                download_queue_create(download_id, cmd_tag, body.get("download_file"), host_tag)
            return StreamingResponse(
                wait_download_response(cmd_tag, host_tag, source_terminal, params, request),
                media_type="application/x-ndjson",
            )
        # Mode 03 > Normal with size limit
        else:
            return await done(body, await wait_response(cmd_tag, host_tag, command, source_terminal, params))

    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | terminal | {e}")
        return await conclude_request({"status": "error", "message": str(e)}, status_code=500, body=body, type="terminal")


async def main_terminal(body):
    # Entrypoint that runs a terminal command
    return await main_session_commands(body)
