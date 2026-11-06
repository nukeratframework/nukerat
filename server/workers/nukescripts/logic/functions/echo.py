from utils.querys import add_nukescript_output


def run(content):
    # Stores the script output in the DB
    add_nukescript_output(str(content))
