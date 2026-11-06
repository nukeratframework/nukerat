from logic.scripts.validation.helpers import check_args, err, line_no, string_kw

def validate(node, line_map):
    # Checks the message box args and the type
    result = check_args(node, line_map, "message_box", 2, 2)
    if result:
        return result
    line = line_no(node, line_map)
    for kw in node.keywords:
        if kw.arg != "type":
            return err(line, f'unknown message_box arg "{kw.arg}"')
    return string_kw(node, line_map, "message_box", "type", ("info", "error", "success"))
