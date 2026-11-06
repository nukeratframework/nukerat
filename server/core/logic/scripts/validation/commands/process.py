from logic.scripts.validation.helpers import check_args, reject_kw

def validate(node, line_map):
    # Checks the process call args
    return check_args(node, line_map, "process", 1, 1) or reject_kw(node, line_map, "process")
