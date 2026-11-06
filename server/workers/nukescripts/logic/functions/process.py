from infra.general.create_log import logger, write_log

runner = None


def tag_value(tag):
    # Checks the host tag and strips spaces
    if not isinstance(tag, str):
        raise RuntimeError("process expects host tag string")
    value = tag.strip()
    if not value:
        raise RuntimeError("process missing tag")
    return value


def run(tag):
    # Lists the processes of the host
    if not runner:
        raise RuntimeError("process runner not configured")
    try:
        host_tag = tag_value(tag)
        result = runner(host_tag)
        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/process | {e}")
        return {"status": "failure", "error": str(e)}
