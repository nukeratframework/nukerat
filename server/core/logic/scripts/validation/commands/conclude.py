from logic.scripts.validation.helpers import check_args, reject_kw

def validate(node, line_map):
    # Checks the conclude call args
    return check_args(node, line_map, "conclude", 2, 2) or reject_kw(node, line_map, "conclude")
