import asyncio
import threading
from pathlib import Path

import utils.nukescripts.calls.file_server as file_server_call
import utils.nukescripts.calls.network as network_call
import utils.nukescripts.calls.agent as agent_call
import utils.nukescripts.calls.async_cmd as async_cmd_call
import utils.nukescripts.calls.screenshot as screenshot_call
import utils.nukescripts.calls.cmd as cmd_call
import utils.nukescripts.calls.explorer as explorer_call
import utils.nukescripts.calls.process as process_call

worker_dir = Path(__file__).resolve().parents[3] / "workers" / "nukescripts"


def start_worker():
    # Starts the nukescript worker and wires the native runners
    loop = asyncio.get_running_loop()
    screenshot_call.main_loop = loop
    file_server_call.main_loop = loop
    network_call.main_loop = loop
    agent_call.main_loop = loop
    async_cmd_call.main_loop = loop
    cmd_call.main_loop = loop
    explorer_call.main_loop = loop
    process_call.main_loop = loop

    ready = threading.Event()
    state: dict = {}

    def run():
        # Boots the worker loop and registers the call runners
        import sys

        try:
            sys.path.insert(0, str(worker_dir))
            from utils.setup_path import activate

            activate()

            from logic.functions.file_server import file_server as worker_file_server
            from logic.functions.network import network as worker_network
            from logic.functions import agent as worker_agent
            from logic.functions import async_cmd as worker_async_cmd
            from logic.functions import cmd as worker_cmd
            from logic.functions import folders as worker_folders  # NukeScript command name
            from logic.functions import process as worker_process
            from logic.functions import screenshot as worker_screenshot
            from logic.core import main

            worker_file_server.upload_runner = file_server_call.dispatch_upload
            worker_file_server.delete_runner = file_server_call.dispatch_delete
            worker_network.add_socks_runner = network_call.dispatch_add_socks
            worker_network.add_forward_runner = network_call.dispatch_add_forward
            worker_network.remove_runner = network_call.dispatch_remove
            worker_network.restart_runner = network_call.dispatch_restart
            worker_agent.runner = agent_call.dispatch_agent
            worker_async_cmd.runner = async_cmd_call.dispatch_async_cmd
            worker_cmd.runner = cmd_call.dispatch_cmd
            worker_folders.runner = explorer_call.dispatch_explorer
            worker_process.runner = process_call.dispatch_process
            worker_screenshot.runner = screenshot_call.dispatch_screenshot
            main(ready=ready)
        except BaseException as exc:
            state["error"] = exc
            ready.set()

    threading.Thread(target=run, daemon=True, name="nukescripts-worker").start()
    return ready, state
