from logic.scripts.validation.helpers import check_args, err, line_no, reject_kw

def validate(node, line_map):
    # Checks the file server call args
    return check_args(node, line_map, "file_server", 0, 0) or reject_kw(node, line_map, "file_server")

def validate_attr(node, line_map):
    # Checks the file server method args
    line = line_no(node, line_map)
    method = node.func.attr
    if method == "upload":
        result = check_args(node, line_map, "file_server.upload", 2, 2)
    elif method == "delete":
        result = check_args(node, line_map, "file_server.delete", 2, 2)
    else:
        return err(line, f'unknown file_server method "{method}"')
    if result:
        return result
    return reject_kw(node, line_map, f"file_server.{method}")
