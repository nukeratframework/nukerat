from logic.scripts.validation.helpers import check_args, err, line_no, reject_kw

def validate(node, line_map):
    # Checks the credentials call args
    return check_args(node, line_map, "credentials", 0, 0) or reject_kw(node, line_map, "credentials")

def validate_attr(node, line_map):
    # Checks the credentials method args
    line = line_no(node, line_map)
    method = node.func.attr
    if method == "add":
        result = check_args(node, line_map, "credentials.add", 4, 4)
    elif method == "remove":
        result = check_args(node, line_map, "credentials.remove", 1, 1)
    else:
        return err(line, f'unknown credentials method "{method}"')
    if result:
        return result
    return reject_kw(node, line_map, f"credentials.{method}")
