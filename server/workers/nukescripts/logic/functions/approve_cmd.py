from utils.querys import approve_queue_tag


def run(tag):
    # Marks the queue line as approved
    approve_queue_tag(str(tag).strip())
