usage = """USAGE:
    server <command> ...

COMMANDS
    start                       Start server

    config list                 List server config
    config set <key> <value>    Set server config
    config reset <key>          Reset server config to default
    config load <file>          Load server config from file
    config create-tls           Create a self signed cert and enable TLS

    key list                    List operators keys
    key add <name>              Create operator key
    key rem <name>              Remove operator key

    venv list                   List installed python packages
    venv install <package>      Install a python package
    venv uninstall <package>    Uninstall a python package

    db usage                    Show database information
    db export <path>            Export database to a file
    db import <file>            Import database from a file
"""
