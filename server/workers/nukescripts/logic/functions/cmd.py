from infra.general.create_log import logger, write_log

runner = None


def tag_value(tag):
    # Checks the host tag and strips spaces
    if not isinstance(tag, str):
        raise RuntimeError("cmd expects host tag string")
    value = tag.strip()
    if not value:
        raise RuntimeError("cmd missing tag")
    return value


def run(tag, command):
    # Sends the command to the host and returns the output
    cmd_str = str(command)
    if not runner:
        raise RuntimeError("cmd runner not configured")
    try:
        host_tag = tag_value(tag)
        result = runner(host_tag, cmd_str)
        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/cmd | {e}")
        return str(e)
