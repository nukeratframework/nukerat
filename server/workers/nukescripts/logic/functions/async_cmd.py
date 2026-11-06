from infra.general.create_log import logger, write_log

runner = None


def tag_value(tag):
    # Checks the host tag and strips spaces
    if not isinstance(tag, str):
        raise RuntimeError("async_cmd expects host tag string")
    value = tag.strip()
    if not value:
        raise RuntimeError("async_cmd missing tag")
    return value


def run(tag, command):
    # Sends the command to the host without waiting for output
    cmd_str = str(command)
    if not runner:
        raise RuntimeError("async_cmd runner not configured")
    try:
        host_tag = tag_value(tag)
        runner(host_tag, cmd_str)
        return None
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/async_cmd | {e}")
        return str(e)
