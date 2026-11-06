import asyncio
import base64


async def run_in_thread(func, *args, **kwargs):
    # Runs a blocking call in a thread
    return await asyncio.to_thread(func, *args, **kwargs)


def build_file_b64(path: str) -> str:
    # Reads a build file as base64
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


async def read_build_b64(path: str) -> str:
    # Reads a build file as base64 in a thread
    return await run_in_thread(build_file_b64, path)
