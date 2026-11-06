import ast

def err(line, msg):
    # Builds a script error for one line
    return {"status": "failure", "message": f"Error: line {line}: {msg}"}

def line_no(node, line_map):
    # Maps the node line back to the script line
    return line_map.get(node.lineno, node.lineno)

def check_args(node, line_map, name, min_args, max_args, kw_only=False):
    # Checks the arg count of a command call
    line = line_no(node, line_map)
    n = len(node.args)
    if n < min_args:
        return err(line, f"{name} missing required args")
    if n > max_args:
        if kw_only:
            return err(line, f"{name} extra args must be keyword-only")
        return err(line, f"too many {name} args")
    return None

def reject_kw(node, line_map, name):
    # Rejects keyword args on a command call
    line = line_no(node, line_map)
    for kw in node.keywords:
        if kw.arg is None:
            return err(line, f"invalid {name} call")
        return err(line, f'unknown {name} arg "{kw.arg}"')
    return None

def string_kw(node, line_map, name, key, allowed=None):
    # Checks that a keyword arg is an allowed string
    line = line_no(node, line_map)
    for kw in node.keywords:
        if kw.arg != key:
            return err(line, f'unknown {name} arg "{kw.arg}"')
        if not isinstance(kw.value, ast.Constant) or not isinstance(kw.value.value, str):
            return err(line, f"{name} {key} must be a string literal")
        if allowed and kw.value.value not in allowed:
            return err(line, f'invalid {name} {key} "{kw.value.value}"')
    return None
