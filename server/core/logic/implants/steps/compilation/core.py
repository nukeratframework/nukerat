from .nim.modes.exe import main as exe_main
from .nim.modes.dll import main as dll_main
from .nim.modes.shellcode import main as shellcode_main
from .nim.modes.elf import main as elf_main
from .nim.modes.so import main as so_main
from .go.modes.app import main as app_main


async def main(body, tag):
    # Routes the build to the selected format
    fmt = body["config"]["format"]

    if fmt == "exe":
        return await exe_main(body, tag)

    if fmt == "dll":
        return await dll_main(body, tag)

    if fmt == "shellcode":
        return await shellcode_main(body, tag)

    if fmt == "elf":
        return await elf_main(body, tag)

    if fmt == "so":
        return await so_main(body, tag)

    if fmt == "app":
        return await app_main(body, tag)

    return {"status": "failure", "message": f"Build not implemented for format '{fmt}'"}
