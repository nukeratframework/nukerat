import asyncio
from pathlib import Path
from infra.database.database import sqlite_db
from utils.nukescripts.calls.cmd import send_cmd

main_loop = None
snap_dir = Path(__file__).resolve().parents[4] / "infra" / "tmp"


def file_stat(path):
    # Returns the size and time of the screenshot file
    if not path.is_file():
        return None
    st = path.stat()
    if st.st_size <= 0:
        return None
    return st.st_size, st.st_mtime_ns


def save_output(output, data):
    # Writes the screenshot bytes to the output path
    path = Path(output)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    except FileNotFoundError:
        return f"output folder not found: {path.parent}"
    except PermissionError:
        return f"permission denied: {path}"
    except OSError as e:
        return str(e)
    return None


def read_snap_bytes(path: Path) -> bytes:
    # Reads the screenshot file bytes
    return path.read_bytes()


async def send_screenshot(host_tag, output=None):
    # Takes a screenshot on the host and waits for the file
    path = snap_dir / f"{host_tag}.jpg"
    before = await asyncio.to_thread(file_stat, path)

    await send_cmd(host_tag, "screenshot")

    delay = await sqlite_db.get_host_delay(host_tag)
    sleep_time = max(0.2, float(delay))
    iterations = int((delay + 30.0) / sleep_time)
    pending = None

    for _ in range(iterations):
        current = await asyncio.to_thread(file_stat, path)
        if current and current != before:
            if pending == current:
                data = await asyncio.to_thread(read_snap_bytes, path)
                result = {"status": "success", "data": data}
                if output:
                    error = await asyncio.to_thread(save_output, output, data)
                    if error:
                        return {"status": "failure", "error": error}
                    result["output"] = output
                return result
            pending = current
        else:
            pending = None
        await asyncio.sleep(sleep_time)

    return {"status": "failure", "error": "Screenshot timeout"}


def dispatch_screenshot(host_tag, output=None):
    # Runs the screenshot call on the main loop
    future = asyncio.run_coroutine_threadsafe(
        send_screenshot(host_tag, output=output),
        main_loop,
    )
    return future.result()
