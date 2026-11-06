from logic.scripts.validation.helpers import check_args, err, line_no, reject_kw


def validate(node, line_map):
    # Checks the network call args
    return check_args(node, line_map, "network", 0, 0) or reject_kw(node, line_map, "network")


def validate_attr(node, line_map):
    # Checks the network method args
    line = line_no(node, line_map)
    method = node.func.attr
    if method == "add_socks":
        result = check_args(node, line_map, "network.add_socks", 2, 4)
    elif method == "add_forward":
        result = check_args(node, line_map, "network.add_forward", 4, 4)
    elif method == "remove":
        result = check_args(node, line_map, "network.remove", 1, 1)
    elif method == "restart":
        result = check_args(node, line_map, "network.restart", 1, 1)
    else:
        return err(line, f'unknown network method "{method}"')
    if result:
        return result
    return reject_kw(node, line_map, f"network.{method}")
