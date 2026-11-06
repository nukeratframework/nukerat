import base64
import secrets
import shlex
import string
from pathlib import Path


def extract_tmp_file(command, params):
    # Writes the blob bytes into a tmp file
    if not params.get("__tmp_file_bytes__"):
        parts = shlex.split(command, posix=False)
        i = 0
        while i < len(parts):
            if parts[i] == "--__tmp_file_bytes__" and i + 1 < len(parts):
                params["__tmp_file_bytes__"] = parts[i + 1]
                i += 2
            else:
                i += 1

    if not params.get("__tmp_file_bytes__"):
        return

    tmp_dir = Path(__file__).resolve().parents[4] / "infra" / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    name = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(23))
    ext = Path(str(params.get("file", ""))).suffix
    output_file = tmp_dir / f"{name}{ext}"
    blob = params["__tmp_file_bytes__"]
    output_file.write_bytes(blob if isinstance(blob, (bytes, bytearray)) else base64.b64decode(blob))
    tmp_path = str(output_file)
    params["_tmp_file_path"] = tmp_path
    params["file"] = tmp_path
    params.pop("__tmp_file_bytes__", None)
