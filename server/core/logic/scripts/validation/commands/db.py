from logic.scripts.validation.helpers import check_args, err, line_no, reject_kw

tables = (
    "users",
    "terminal",
    "hosts",
    "listeners",
    "folders",
    "process",
    "queue",
    "agents",
    "agents_history",
    "credentials",
    "keylogger",
    "nukescripts",
    "nukescripts_output",
    "custom_notifications",
    "checkins",
)


def validate(node, line_map):
    # Checks the db call args
    return check_args(node, line_map, "db", 0, 0) or reject_kw(node, line_map, "db")


def validate_attr(node, line_map):
    # Checks the db table call args
    line = line_no(node, line_map)
    table = node.func.attr
    if table not in tables:
        return err(line, f'unknown table "{table}"')
    result = check_args(node, line_map, f"db.{table}", 0, 1)
    if result:
        return result
    return reject_kw(node, line_map, f"db.{table}")
