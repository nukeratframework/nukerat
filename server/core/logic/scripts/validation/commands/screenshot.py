from logic.scripts.validation.helpers import check_args, err, line_no, string_kw

def validate(node, line_map):
    # Checks the screenshot args and the output
    result = check_args(node, line_map, "screenshot", 1, 1, kw_only=True)
    if result:
        return result
    line = line_no(node, line_map)
    for kw in node.keywords:
        if kw.arg != "output":
            return err(line, f'unknown screenshot arg "{kw.arg}"')
    return string_kw(node, line_map, "screenshot", "output")
