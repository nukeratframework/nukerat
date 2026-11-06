import asyncio
import json
import os
import base64
from pathlib import Path

from core.logic.implants.steps.compilation.nim.utils.donut import main as donut_main
from core.logic.implants.steps.compilation.nim.utils.encoder import apply_shellcode_encoder
from infra.database.database import Builds, Host
from infra.database.listener_utils import listener_utils
from infra.general.create_log import logger, write_log


async def check_optional_encoder(shellcode: bytes, parameters: dict, tag: str) -> bytes:
    # Applies the optional shellcode encoder when one is set
    encoder = str(parameters.get("encoder") or "").strip().lower()
    arch = parameters.get("arch", "x64")
    if not encoder or encoder in ("off", "none"):
        return shellcode
    encoded, err = await apply_shellcode_encoder(
        shellcode,
        {"shellcode_encoder": encoder, "arch": arch},
        tag or "terminal",
    )
    if err:
        raise RuntimeError(err)
    parameters["rwx"] = True
    return encoded


def get_file_from_tmp(parameters: dict) -> str:
    # Returns the tmp file path stored in the parameters
    file_path = parameters.get("_tmp_file_path", "")
    if not file_path:
        raise ValueError("Tmp file path is required")
    if not os.path.isfile(file_path):
        raise FileNotFoundError("Tmp file not found")
    return file_path


def delete_tmp_file(parameters: dict):
    # Deletes the tmp file stored in the parameters
    file_path = parameters.pop("_tmp_file_path", "")
    if file_path:
        Path(file_path).unlink(missing_ok=True)


async def is_bof_compatible(host_tag, parameters=None):
    # Checks if the host can run a BOF
    if not host_tag:
        return True
    rows = await listener_utils.read(Host, tag=host_tag)
    if not rows:
        return True
    host_os = (rows[0].os or "").lower()
    if "linux" in host_os:
        return True
    if "mac" in host_os or "darwin" in host_os:
        return False
    return True


def resolve_content_file(parameters: dict):
    # Resolves the content file from tmp or from the given path
    try:
        if parameters.get("_tmp_file_path"):
            return get_file_from_tmp(parameters), True
        file_path = parameters.get("file", "")
        if not file_path:
            raise ValueError("File is empty")
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        return file_path, False
    except (FileNotFoundError, ValueError) as e:
        write_log(logger, "error", f"Unhandled exception | get content | {e}")
        raise


def encode_resolved_file_b64(parameters: dict, empty_error: str) -> str:
    # Reads the resolved file and returns it as base64
    file_path, from_tmp = resolve_content_file(parameters)
    with open(file_path, "rb") as f:
        payload = f.read()
    if not payload:
        raise RuntimeError(empty_error)
    if from_tmp:
        delete_tmp_file(parameters)
    return base64.b64encode(payload).decode("utf-8")


async def get_dotnet_content(parameters: dict, call_args, mode=None, inline=False):
    # Returns the dotnet file contents as base64
    return await asyncio.to_thread(
        encode_resolved_file_b64, parameters, "Error: file not found or empty"
    )


async def get_raw_bytes_content(parameters: dict) -> str:
    # Returns the raw file bytes as base64
    return await asyncio.to_thread(encode_resolved_file_b64, parameters, "File is empty")


def apply_bof_arg_tmp(parameters: dict, row_data: dict, call_args: str):
    # Replaces BOF argument placeholders with tmp file contents
    if not call_args:
        return
    mapping = parameters.pop("bof_arg_tmp", None) or {}
    if not mapping:
        return
    out = call_args
    for orig, tmp_path in mapping.items():
        path = Path(tmp_path)
        if not path.is_file():
            raise FileNotFoundError(f"Bof arg tmp not found: {tmp_path}")
        b64_value = path.read_bytes().decode("ascii").strip()
        out = out.replace(f"b:{orig}", f"b:{b64_value}")
        path.unlink(missing_ok=True)
    parameters["args"] = out
    row_data["parameters"] = parameters


async def get_file_bytes_path(parameters: dict, row_data: dict, call_args):
    # Applies the BOF argument tmp files onto the call args
    await asyncio.to_thread(apply_bof_arg_tmp, parameters, row_data, call_args)


async def get_bof_content(parameters: dict, row_data: dict):
    # Loads the BOF file as base64 when the host is compatible
    if not await is_bof_compatible(row_data.get("host"), parameters):
        return
    row_data["input"] = await asyncio.to_thread(
        encode_resolved_file_b64, parameters, "BOF file is empty"
    )


async def get_donut_content(parameters: dict, call_args, tag: str = "") -> str:
    # Builds donut shellcode from the file and returns base64
    file_path, from_tmp = resolve_content_file(parameters)

    if call_args:
        shellcode = await donut_main(
            file=file_path,
            params=call_args,
            arch=2,
            exit_opt=1
        )
    else:
        shellcode = await donut_main(
            file=file_path,
            arch=2,
            exit_opt=1
        )

    if shellcode is None:
        raise RuntimeError("donut.create returned None")

    if from_tmp:
        delete_tmp_file(parameters)
    shellcode = await check_optional_encoder(shellcode, parameters, tag)
    return base64.b64encode(shellcode).decode("utf-8")


def read_tmp_shellcode_bytes(parameters: dict) -> bytes:
    # Reads the tmp shellcode file and returns the raw bytes
    file_path = get_file_from_tmp(parameters)
    with open(file_path, "rb") as f:
        shellcode_bytes = f.read()
    if not shellcode_bytes:
        raise RuntimeError("Shellcode file is empty")
    delete_tmp_file(parameters)
    return shellcode_bytes


async def get_shellcode_content(parameters: dict, tag: str = "") -> str:
    # Loads the shellcode, applies the encoder, and returns base64
    shellcode_bytes = await asyncio.to_thread(read_tmp_shellcode_bytes, parameters)
    shellcode_bytes = await check_optional_encoder(shellcode_bytes, parameters, tag)
    return base64.b64encode(shellcode_bytes).decode("utf-8")


async def resolve_migrate_shellcode_path(host_tag: str) -> str:
    # Finds the migrate shellcode path for this host
    rows = await listener_utils.read(Host, tag=host_tag)
    if not rows:
        raise RuntimeError("Host not found")

    cfg_raw = rows[0].implant_config or "{}"
    cfg = json.loads(cfg_raw) if isinstance(cfg_raw, str) else (cfg_raw or {})
    build_tag = str(cfg.get("build_tag") or cfg.get("buildTag") or "").strip()
    if not build_tag:
        raise RuntimeError("Host has no build_tag in implant_config")

    build_rows = await listener_utils.read(Builds, tag=build_tag)
    default_path = Path(__file__).resolve().parents[6] / "infra" / "builds" / f"{build_tag}.bin"
    if build_rows and build_rows[0].shellcode_path:
        file_path = build_rows[0].shellcode_path
        if not os.path.isfile(file_path):
            file_path = str(default_path)
    else:
        file_path = str(default_path)

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Migrate shellcode not found: {file_path}")
    return file_path


def read_file_b64(file_path: str, empty_error: str) -> str:
    # Reads a file and returns its contents as base64
    with open(file_path, "rb") as f:
        shellcode_bytes = f.read()
    if not shellcode_bytes:
        raise RuntimeError(empty_error)
    return base64.b64encode(shellcode_bytes).decode("utf-8")


async def get_migrate_content(host_tag: str) -> str:
    # Returns the host migrate shellcode as base64
    file_path = await resolve_migrate_shellcode_path(host_tag)
    return await asyncio.to_thread(read_file_b64, file_path, "Migrate shellcode file is empty")


def read_upload_file_b64(parameters: dict) -> str:
    # Reads the upload file and returns it as base64
    file_path, from_tmp = resolve_content_file(parameters)
    with open(file_path, "rb") as f:
        data = f.read()
    if not data:
        raise RuntimeError("Tmp file is empty")
    if from_tmp:
        delete_tmp_file(parameters)
    return base64.b64encode(data).decode("utf-8")


async def get_tmp_content(parameters: dict) -> str:
    # Returns the tmp upload file as base64
    return await asyncio.to_thread(read_upload_file_b64, parameters)
