from utils.querys import conclude_queue_tag


def run(tag, message):
    # Marks the queue line as completed with a message
    tag = str(tag).strip()
    msg = str(message).strip()
    conclude_queue_tag(tag, msg)
