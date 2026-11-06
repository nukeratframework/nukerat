import asyncio
import os

import donut

from .paths import dir, file


async def main(tag=None, **kwargs):
    # Builds a donut loader and removes the temp file
    out = kwargs.get("output")
    if not out:
        out = await file(tag, ".loader.bin") if tag else os.path.join(await dir(), ".donut.loader.bin")
        kwargs["output"] = out

    try:
        return await asyncio.to_thread(donut.create, **kwargs)
    finally:
        if os.path.isfile(out):
            os.remove(out)
