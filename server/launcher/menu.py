import os
import sys
from launcher.utils.ascii import banner
from launcher.utils.help import usage


def main_menu():
    # Parse CLI args and dispatch to the matching handlers
    try:
        args = sys.argv[1:]

        if not args:
            print(usage)

            return

        command = " ".join(args).strip()
        command = " ".join(command.split())

        if command == "start":
            banner()
            from .logic.start import main_start
            main_start()
        elif command.startswith("key"):
            from .logic.operator import main_operator
            main_operator(command)
        elif command.startswith("config"):
            from .logic.config_cmd import main_config
            main_config(command)
        elif command.startswith("venv"):
            from .logic.venv_cmd import main_venv
            main_venv(command)
        elif command.startswith("db"):
            from .logic.db_cmd import main_db
            main_db(command)
        else:
            print("Command not found. Use 'help' to see the available commands.")
            sys.exit(1)
    except KeyboardInterrupt:
        os._exit(0)
