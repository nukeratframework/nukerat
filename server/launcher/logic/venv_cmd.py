from launcher.utils.venv import venv_install, venv_list, venv_uninstall


def main_venv(option):
    # Receives the venv command and calls list, install or uninstall
    parts = option.split()
    if len(parts) < 2 or parts[0] != "venv":
        print("Invalid option")
        return

    cmd = parts[1]

    if cmd == "list":
        if len(parts) != 2:
            print('Invalid syntax. Use "venv list".')
            return
        venv_list()
        return

    if cmd == "install":
        if len(parts) != 3:
            print('Invalid syntax. Use "venv install <package>".')
            return
        venv_install(parts[2])
        return

    if cmd == "uninstall":
        if len(parts) != 3:
            print('Invalid syntax. Use "venv uninstall <package>".')
            return
        venv_uninstall(parts[2])
        return

    print("Invalid option")
