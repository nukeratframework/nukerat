from ..utils.keys import key_add, key_list, key_rem


def main_operator(option):
    # Receives the key command and calls add, list or rem
    option = option.split()

    if len(option) < 1 or option[0] != "key":
        print("Invalid option")
        return

    if len(option) == 2 and option[1] == "list":
        key_list()
        return

    if len(option) < 3:
        print('Invalid syntax. Use "key add <name>" or "key rem <name>".')
        return

    name = option[2]

    if option[1] == "add":
        key_add(name)
    elif option[1] == "rem":
        key_rem(name)
    else:
        print("Invalid option")
