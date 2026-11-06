from launcher.utils.config import (
    config_create_tls,
    config_list,
    config_load,
    config_reset,
    config_set,
)


def main_config(option):
    # Receives the config command and calls list, set, reset, load or create tls
    parts = option.split()
    if len(parts) < 2 or parts[0] != "config":
        print("Invalid option")
        return

    cmd = parts[1]

    if cmd == "list":
        if len(parts) != 2:
            print('Invalid syntax. Use "config list".')
            return
        config_list()
        return

    if cmd == "set":
        if len(parts) < 4:
            print('Invalid syntax. Use "config set <key> <value>".')
            return
        key = parts[2]
        value = " ".join(parts[3:])
        config_set(key, value)
        return

    if cmd == "reset":
        if len(parts) != 3:
            print('Invalid syntax. Use "config reset <key>".')
            return
        config_reset(parts[2])
        return

    if cmd == "load":
        if len(parts) != 3:
            print('Invalid syntax. Use "config load <file>".')
            return
        exit_code = config_load(parts[2])
        if exit_code:
            raise SystemExit(exit_code)
        return

    if cmd == "create-tls":
        if len(parts) != 2:
            print('Invalid syntax. Use "config create-tls".')
            return
        exit_code = config_create_tls()
        if exit_code:
            raise SystemExit(exit_code)
        return

    print("Invalid option")
