import os
import base64
from pathlib import Path

from ...blocking_io import run_in_thread


def server_root():
    # Returns the server root
    return Path(__file__).resolve().parents[7]


def implants_root():
    # Returns the implants root
    return server_root().parent / "implants"


def tmp_dir():
    # Creates the tmp folder and returns it
    root = server_root() / "infra" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


async def project(body):
    # Returns the implant source folder
    config = body["config"]
    os_name = str(config.get("operational_system", "windows")).strip().lower()
    if os_name == "macos":
        os_name = "mac"
    base = str(body.get("implant_base", "stageless")).strip().lower()
    return os.path.join(str(implants_root()), os_name, base)


async def output(tag):
    # Returns the exe output path
    return await file(tag, ".exe")


async def dir():
    # Returns the tmp folder path
    return str(tmp_dir())


async def file(tag, suffix):
    # Builds a tmp file path for the tag
    return os.path.join(await dir(), f"{tag}{suffix}")


async def write_b64(tag, data, kind):
    # Writes a base64 blob into a tmp file
    if not isinstance(data, dict):
        return None

    encoded = str(data.get("bytes", "")).strip()
    if not encoded:
        return None

    name = str(data.get("name", "")).strip()
    default_ext = ".ico" if kind == "icon" else ".bin"
    ext = os.path.splitext(name)[1] or default_ext
    path = await file(tag, f".{kind}{ext}")

    def write():
        # Writes the decoded bytes to disk
        with open(path, "wb") as f:
            f.write(base64.b64decode(encoded))

    await run_in_thread(write)
    return path


def cleanup_sync(tag, root: str) -> None:
    # Deletes the tmp files of the tag
    prefix = f"{tag}."
    for entry in os.listdir(root):
        if entry.startswith(prefix):
            os.remove(os.path.join(root, entry))


async def cleanup(tag):
    # Deletes the tmp files of the tag in a thread
    root = await dir()
    await run_in_thread(cleanup_sync, tag, root)
