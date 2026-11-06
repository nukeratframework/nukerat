from infra.general.create_log import logger, write_log

runner = None


def run(tag, path):
    # Lists the folder path on the host
    if not runner:
        raise RuntimeError("folders runner not configured")
    try:
        if not isinstance(tag, str) or not str(tag).strip():
            raise RuntimeError("folders missing tag")
        if not isinstance(path, str) or not str(path).strip():
            raise RuntimeError("folders missing path")
        host_tag = str(tag).strip()
        folder_path = str(path).strip()
        result = runner(host_tag, folder_path)
        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/folders | {e}")
        return {"status": "failure", "error": str(e)}
