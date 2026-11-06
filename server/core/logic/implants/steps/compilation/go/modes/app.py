from ..utils.build import build as compile_main
from .common import run


async def main(body, tag):
    # Builds a go app implant
    return await run(body, tag, compile_main)
