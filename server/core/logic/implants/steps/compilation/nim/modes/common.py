from ...blocking_io import read_build_b64, run_in_thread
from ..utils.paths import project, cleanup
from ..utils.prep import (
    replace as replace_placeholders,
    cleanup as cleanup_build,
    inject_preface,
    inject_custom_channel,
    inject_custom_http_relay,
)


async def run(body, tag, compile_fn):
    # Prepares the nim source, compiles it and returns the bytes
    config = body["config"]

    src = None
    try:
        src = await project(body)
        await run_in_thread(cleanup_build, src)
        await inject_custom_channel(config, src)
        await inject_custom_http_relay(config, src)
        await replace_placeholders(src, config, tag, body.get("implant_base", "stageless"))

        if config.get("preface"):
            await inject_preface(config, src)
        else:
            ...

        # COMPILE ===============================================================

        build = await compile_fn(config, tag, body)
        if build.get("status") == "failure":
            return build

        # FINAL OUTPUT ==========================================================

        data = await read_build_b64(build["path"])

        return {
            "status": "success",
            "message": "Implant built successfully",
            "bytes": data,
            "stdout": build["stdout"],
            "stderr": build["stderr"],
        }
    finally:
        await cleanup(tag)
        await run_in_thread(cleanup_build, src)
