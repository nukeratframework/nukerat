from utils.querys import reject_queue_tag


def run(tag, script_name, line_input):
    # Rejects the queue line and marks it completed
    tag = str(tag).strip()
    reject_queue_tag(tag, script_name, line_input)
