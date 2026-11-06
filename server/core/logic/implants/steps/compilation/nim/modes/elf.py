from ..utils.build import elf as compile_main
from .common import run


async def main(body, tag):
    # Builds an elf implant
    return await run(body, tag, compile_main)
