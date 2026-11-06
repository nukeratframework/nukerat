#!/usr/bin/env python3

# Copyright (C) 2026 Gustavo Henrique T.
# SPDX-License-Identifier: GPL-3.0-or-later
# See LICENSE in the repository root.

#⠀ ⠀⠀⠀⠀⠀⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
#⠀ ⠀⠀⣠⣶⡿⠿⠛⠿⣷⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
#⠀ ⠀⣰⣿⠋⠀⠀⠀⠀⠀⠹⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
#⠀ ⠀⣿⡇⠀⠀⠀⠀⠀⠀⠀⢿⣷⣦⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
#⠀ ⠀⠹⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠉⠙⠻⣷⣦⡀⠀⠀⠀⠀⠀  ~ NUKERAT
#⠀ ⠀⠀⠙⣿⣷⣶⣤⠤⠀⠀⠀⠀⣴⣶⣄⠈⠻⣿⣆⠀⠀⠀⠀  Post exploitation framework  
#⠀ ⠀⣠⣾⣿⣃⣀⣀⠀⠀⠀⠀⠀⠙⠛⠛⠂⠀⠈⢿⣧⠀⠀⠀⠀⠀
#⠀ ⠚⠛⢛⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣤⣾⡿⠀⠀⠀⠀⠀
#⠀ ⢀⣴⣿⣿⣷⣶⣶⣶⠆⢀⣾⣿⡿⠿⠿⠛⠛⠋⠁⠀⠀⠀⠀⠀⠀
#⠀ ⠀⠀⠀⠀⠀⠀⠀⠀⣴⠟⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
#⠀ ⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

import os
import re
import sys
from pathlib import Path

# VARIABLES ======================================================================================

root = Path(__file__).resolve().parent
nukerat_cmd = Path(sys.argv[0]).name

server_root = root / "server"
client_root = root / "client" / "gui"
client_app = client_root / "dist" / "nukerat.AppImage"

nukerat_help = f"""USAGE:
    {nukerat_cmd} <mode> <command> ...

MODES
    server                             Server mode
    client                             Client mode

COMMANDS
    help                               Show this help message
    version                            Show version of the server and client

    server start                       Start server
    client start                       Start client

    server config list                 List server config
    server config set <key> <value>    Set server config
    server config reset <key>          Reset server config to default
    server config load <file>          Load server config from file
    server config create-tls           Create a self signed cert and enable TLS

    server key list                    List operators keys
    server key add john                Create operator key
    server key rem john                Remove operator key

    server venv list                   List installed python packages
    server venv install <package>      Install a python package
    server venv uninstall <package>    Uninstall a python package
    
    server db usage                    Show database information
    server db export <path>            Export database to a file
    server db import <file>            Import database from a file
"""

# FUNCTIONS ======================================================================================


def client():
    gui = Path("/usr/local/bin/nukerat-gui")
    if os.access(gui, os.X_OK):
        os.execv(gui, [str(gui)])

    if not os.access(client_app, os.X_OK):
        print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Client AppImage not found: {client_app}", file=sys.stderr)
        sys.exit(1)

    # Fix display for root user
    env = os.environ.copy()
    if os.geteuid() == 0:
        env["DISPLAY"] = env.get("DISPLAY") or ":0"
        sudo_user = env.get("SUDO_USER", "")
        if sudo_user:
            env["XAUTHORITY"] = f"/home/{sudo_user}/.Xauthority"

    # Start
    argv = [str(client_app)]
    if os.geteuid() == 0:
        argv.append("--no-sandbox")
    os.execve(str(client_app), argv, env)


def server(argv):
    # Validations
    if not server_root.is_dir():
        print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Server dir not found: {server_root}", file=sys.stderr)
        sys.exit(1)

    venv_python = server_root / "venv" / "bin" / "python3"

    if not os.access(venv_python, os.X_OK):
        print(f"[ \x1b[38;2;255;48;48mERROR\x1b[0m ] Venv python not found: {venv_python}", file=sys.stderr)
        sys.exit(1)

    env = os.environ.copy()
    env["PYTHONPATH"] = f"{server_root}:{server_root / 'core'}"

    # Start
    main_py = server_root / "main.py"
    os.execve(
        str(venv_python),
        [str(venv_python), str(main_py), *argv],
        env,
    )


def version():
    sv = ""
    cv = ""
    version_py = server_root / "version.py"
    if version_py.is_file():
        for line in version_py.read_text().splitlines():
            m = re.match(r'^\s*__version__\s*=\s*"([^"]*)"', line)
            if m:
                sv = m.group(1)
                break
    package_json = client_root / "package.json"
    if package_json.is_file():
        for line in package_json.read_text().splitlines():
            m = re.search(r'.*"version"\s*:\s*"([^"]*)"', line)
            if m:
                cv = m.group(1)
                break
    if not sv:
        sv = "unknown"
    if not cv:
        cv = "unknown"
    print(f"client\t{cv}")
    print(f"server\t{sv}")


# MAIN LOGIC =====================================================================================

args = sys.argv[1:]
args_spaced = f" {' '.join(args)} " if args else " "

if len(args) == 0 or " help " in args_spaced:
    print(nukerat_help)
    sys.exit(0)

if len(args) >= 2 and args[0] == "client" and args[1] == "start":
    if os.geteuid() == 0:
        print("[ \x1b[38;2;255;48;48mERROR\x1b[0m ] The client must not be executed with sudo", file=sys.stderr)
        sys.exit(1)
    client()

if len(args) >= 1 and args[0] == "server":
    if os.geteuid() == 0:
        print("[ \x1b[38;2;255;48;48mERROR\x1b[0m ] The server must not be executed with sudo", file=sys.stderr)
        sys.exit(1)
    server(args[1:])

if len(args) >= 1 and args[0] == "version":
    version()
    sys.exit(0)

print(nukerat_help, file=sys.stderr)
sys.exit(1)
