from infra.general.create_log import listener_logger as logger, setup_logging, write_log

def create_log(msg, level="info", client="-"):
    # Writes the file server log with the client address
    client = (client or "-")[:15]
    write_log(logger, level, f"{msg} | {client} | file")
