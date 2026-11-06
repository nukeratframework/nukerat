from utils.querys import add_custom_notification


def run(title, body, *, type="info"):
    # Stores a custom notification in the DB
    if type not in ("info", "error", "success"):
        raise ValueError(f'invalid type "{type}"')
    add_custom_notification(str(title), str(body), type)
