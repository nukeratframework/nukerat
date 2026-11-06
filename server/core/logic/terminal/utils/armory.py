import asyncio
import json
import os
import secrets
import shutil
import httpx
from infra.general.create_log import logger, write_log
from launcher.utils.config import config
from ..mapping import commands
from .general import reply
from .paths import armory_dir, tmp_dir

armory_repository = "https://github.com/nukeratframework/armory"
armory_job_semaphore = asyncio.Semaphore(4)
armory_fs_lock = asyncio.Lock()

async def armory_install_all(source_terminal):
    # Downloads and installs every armory tool
    await asyncio.to_thread(tmp_dir.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(os.makedirs, armory_dir, exist_ok=True)
    token = secrets.token_hex(12)
    zip_path = tmp_dir / f"all-{token}.zip"
    extract_dir = tmp_dir / f"armory-all-{token}"
    repo = armory_repository
    armory_conf = config.get("armory")
    if armory_conf and armory_conf.get("repository"):
        repo = armory_conf["repository"].strip().rstrip("/")

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(600.0, connect=30.0),
            headers={"User-Agent": "NukeRat Framework"},
            follow_redirects=True,
        ) as client:
            async with client.stream(
                "GET",
                f"{repo}/releases/latest/download/all.zip",
            ) as response:
                response.raise_for_status()
                handle = await asyncio.to_thread(open, zip_path, "wb")
                try:
                    async for chunk in response.aiter_bytes(8192):
                        await asyncio.to_thread(handle.write, chunk)
                finally:
                    await asyncio.to_thread(handle.close)
    except httpx.HTTPError as e:
        write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
        await asyncio.to_thread(zip_path.unlink, missing_ok=True)
        return reply("failure", str(e), source_terminal)

    try:
        await asyncio.to_thread(extract_dir.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(shutil.unpack_archive, str(zip_path), str(extract_dir), "zip")
    except (OSError, ValueError) as e:
        write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
        await asyncio.to_thread(shutil.rmtree, extract_dir, ignore_errors=True)
        await asyncio.to_thread(zip_path.unlink, missing_ok=True)
        return reply("failure", str(e), source_terminal)

    installed = 0
    skipped = 0
    names = await asyncio.to_thread(os.listdir, extract_dir)
    for name in names:
        extracted = extract_dir / name
        if not await asyncio.to_thread(extracted.is_file):
            continue
        dest = armory_dir / name
        staging = tmp_dir / f"armory-staging-{secrets.token_hex(8)}-{name}"
        await asyncio.to_thread(shutil.move, str(extracted), str(staging))
        async with armory_fs_lock:
            if await asyncio.to_thread(dest.exists):
                skipped += 1
                await asyncio.to_thread(staging.unlink, missing_ok=True)
                continue
            await asyncio.to_thread(shutil.move, str(staging), str(dest))
            installed += 1

    await asyncio.to_thread(shutil.rmtree, extract_dir, ignore_errors=True)
    await asyncio.to_thread(zip_path.unlink, missing_ok=True)

    msg = f"Successfully installed {installed} file(s)."
    if skipped:
        msg = f"{msg} Skipped {skipped} existing file(s)."
    return reply("success", msg, source_terminal)


async def armory_install(tool_name, source_terminal):
    # Downloads and installs one armory tool
    cmd = commands["complete_list"].get(tool_name)
    bin_name = cmd.get("armory_bin") if cmd and cmd.get("is_armory") else None
    if not bin_name:
        for item in commands["complete_list"].values():
            if item.get("is_armory") and item.get("raw") == tool_name:
                bin_name = item.get("armory_bin")
                break
    if not bin_name:
        return reply("failure", 'Tool not found. Use "armory" to list available tools.', source_terminal)

    repo = armory_repository
    armory_conf = config.get("armory")
    if armory_conf and armory_conf.get("repository"):
        repo = armory_conf["repository"].strip().rstrip("/")

    await asyncio.to_thread(os.makedirs, armory_dir, exist_ok=True)
    await asyncio.to_thread(tmp_dir.mkdir, parents=True, exist_ok=True)
    dest = armory_dir / bin_name
    staging = tmp_dir / f"armory-staging-{secrets.token_hex(8)}-{dest.name}"
    url = f"{repo}/releases/latest/download/{bin_name}"

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            headers={"User-Agent": "NukeRat Framework"},
            follow_redirects=True,
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                handle = await asyncio.to_thread(open, staging, "wb")
                try:
                    async for chunk in response.aiter_bytes(8192):
                        await asyncio.to_thread(handle.write, chunk)
                finally:
                    await asyncio.to_thread(handle.close)
    except httpx.HTTPError as e:
        await asyncio.to_thread(staging.unlink, missing_ok=True)
        write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
        return reply("failure", str(e), source_terminal)

    async with armory_fs_lock:
        if await asyncio.to_thread(dest.is_file):
            await asyncio.to_thread(staging.unlink, missing_ok=True)
            return reply("failure", "Tool already downloaded.", source_terminal)
        await asyncio.to_thread(shutil.move, str(staging), str(dest))

    return reply("success", "Successfully installed.", source_terminal)


async def armory_update(tool_name, source_terminal):
    # Updates one armory tool
    await asyncio.to_thread(os.makedirs, armory_dir, exist_ok=True)
    repo = armory_repository
    armory_conf = config.get("armory")
    if armory_conf and armory_conf.get("repository"):
        repo = armory_conf["repository"].strip().rstrip("/")
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            headers={"User-Agent": "NukeRat Framework"},
            follow_redirects=True,
        ) as client:
            response = await client.get(f"{repo}/releases/latest/download/armory.json")
            response.raise_for_status()
            content = response.content
            json.loads(content)
    except (httpx.HTTPError, json.JSONDecodeError) as e:
        write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
        return reply("failure", str(e), source_terminal)

    json_path = armory_dir / "armory.json"
    tmp_path = json_path.with_name(f"armory.{secrets.token_hex(8)}.json.tmp")

    async with armory_fs_lock:
        await asyncio.to_thread(tmp_path.write_bytes, content)
        await asyncio.to_thread(os.replace, tmp_path, json_path)

    if not tool_name:
        return reply("success", "Successfully updated.", source_terminal)

    cmd = commands["complete_list"].get(tool_name)
    bin_name = cmd.get("armory_bin") if cmd and cmd.get("is_armory") else None
    if not bin_name:
        for item in commands["complete_list"].values():
            if item.get("is_armory") and item.get("raw") == tool_name:
                bin_name = item.get("armory_bin")
                break
    if not bin_name:
        return reply("failure", 'Tool not found. Use "armory" to list available tools.', source_terminal)

    await asyncio.to_thread(tmp_dir.mkdir, parents=True, exist_ok=True)
    dest = armory_dir / bin_name
    staging = tmp_dir / f"armory-staging-{secrets.token_hex(8)}-{dest.name}"
    url = f"{repo}/releases/latest/download/{bin_name}"

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            headers={"User-Agent": "NukeRat Framework"},
            follow_redirects=True,
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                handle = await asyncio.to_thread(open, staging, "wb")
                try:
                    async for chunk in response.aiter_bytes(8192):
                        await asyncio.to_thread(handle.write, chunk)
                finally:
                    await asyncio.to_thread(handle.close)
    except httpx.HTTPError as e:
        await asyncio.to_thread(staging.unlink, missing_ok=True)
        write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
        return reply("failure", str(e), source_terminal)

    async with armory_fs_lock:
        if await asyncio.to_thread(dest.is_file):
            await asyncio.to_thread(dest.unlink)
        await asyncio.to_thread(shutil.move, str(staging), str(dest))

    return reply("success", "Successfully updated.", source_terminal)


async def armory_remove(tool_name, source_terminal):
    # Removes one armory tool
    cmd = commands["complete_list"].get(tool_name)
    bin_name = cmd.get("armory_bin") if cmd and cmd.get("is_armory") else None
    if not bin_name:
        for item in commands["complete_list"].values():
            if item.get("is_armory") and item.get("raw") == tool_name:
                bin_name = item.get("armory_bin")
                break
    if not bin_name:
        return reply("failure", 'Tool not found. Use "armory" to list available tools.', source_terminal)

    dest = armory_dir / bin_name
    removed = []
    async with armory_fs_lock:
        if await asyncio.to_thread(dest.is_file):
            await asyncio.to_thread(dest.unlink)
            removed.append(dest.name)

    msg = "Successfully removed." if removed else f"No downloaded files found for tool '{tool_name}'."
    return reply("success", msg, source_terminal)


async def main_armory(verb, input, source_terminal):
    # Routes the armory verb to install, update or remove
    normalized = " ".join(p.strip() for p in input.split(" - ") if p.strip())
    parts = normalized.split()
    tool_name = " ".join(parts[2:]).strip() if len(parts) >= 3 else ""
    if not tool_name and verb != "armory update":
        return reply("failure", "Missing required parameters. Use help <command> for usage.", source_terminal)

    install_all = verb == "armory install all" or (verb == "armory install" and tool_name == "all")
    needs_index = verb != "armory update" and not install_all
    if needs_index:
        json_path = armory_dir / "armory.json"
        if not await asyncio.to_thread(json_path.is_file):
            await asyncio.to_thread(os.makedirs, armory_dir, exist_ok=True)
            repo = armory_repository
            armory_conf = config.get("armory")
            if armory_conf and armory_conf.get("repository"):
                repo = armory_conf["repository"].strip().rstrip("/")
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(120.0, connect=30.0),
                    headers={"User-Agent": "NukeRat Framework"},
                    follow_redirects=True,
                ) as client:
                    response = await client.get(f"{repo}/releases/latest/download/armory.json")
                    response.raise_for_status()
                    content = response.content
                    json.loads(content)
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                write_log(logger, "error", f"Unhandled exception | terminal/armory | {e}")
                return reply("failure", str(e), source_terminal)
            tmp_path = json_path.with_name(f"armory.{secrets.token_hex(8)}.json.tmp")
            async with armory_fs_lock:
                await asyncio.to_thread(tmp_path.write_bytes, content)
                await asyncio.to_thread(os.replace, tmp_path, json_path)

    async with armory_job_semaphore:
        if install_all:
            return await armory_install_all(source_terminal)
        if verb == "armory install":
            return await armory_install(tool_name, source_terminal)
        if verb == "armory update":
            return await armory_update(tool_name, source_terminal)
        if verb == "armory remove":
            return await armory_remove(tool_name, source_terminal)
    return reply("failure", "Unknown armory command.", source_terminal)
