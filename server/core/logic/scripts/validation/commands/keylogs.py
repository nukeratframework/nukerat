from logic.scripts.validation.helpers import check_args, reject_kw

def validate(node, line_map):
    # Checks the keylogs call args
    return check_args(node, line_map, "keylogs", 0, 0) or reject_kw(node, line_map, "keylogs")
