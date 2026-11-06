from infra.general.create_log import logger, write_log

runner = None


def tag_value(tag):
    # Checks the host tag and strips spaces
    if not isinstance(tag, str):
        raise RuntimeError("screenshot expects host tag string")
    value = tag.strip()
    if not value:
        raise RuntimeError("screenshot missing tag")
    return value


def output_value(output):
    # Checks the output path and strips spaces
    if output is None:
        return None
    if not isinstance(output, str):
        raise RuntimeError("screenshot output must be a string")
    value = output.strip()
    if not value:
        raise RuntimeError("screenshot output path is empty")
    return value


def run(tag, *, output=None):
    # Takes a screenshot on the host
    if not runner:
        raise RuntimeError("screenshot runner not configured")
    try:
        host_tag = tag_value(tag)
        output_path = output_value(output)
        result = runner(host_tag, output=output_path)
        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/screenshot | {e}")
        return {"status": "failure", "error": str(e)}
