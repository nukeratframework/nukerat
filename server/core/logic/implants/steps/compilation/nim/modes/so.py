from ..utils.build import so as compile_main
from .common import run


async def main(body, tag):
    # Builds a shared object implant
    return await run(body, tag, compile_main)
