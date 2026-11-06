import asyncio
import os

from .paths import server_root, tmp_dir


async def apply_shellcode_encoder(shellcode, config, tag):
    # Encodes the shellcode with the selected encoder
    encoder = str(config.get("shellcode_encoder")).strip().lower()
    if encoder not in ("sgn", "supernova"):
        return None, f"Unknown shellcode encoder '{encoder}'"

    if not shellcode:
        return None, "Cannot encode empty shellcode"

    safe_tag = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(tag))
    inp = tmp_dir() / f"{safe_tag}.encoder.in.bin"
    out = tmp_dir() / f"{safe_tag}.encoder.out.bin"
    bin_path = server_root() / "infra" / "bin" / "encoders" / encoder / encoder

    if not bin_path.is_file() or not os.access(bin_path, os.X_OK):
        return None, f"Encoder binary not found or not executable: {bin_path}"

    try:
        inp.write_bytes(shellcode)

        if encoder == "sgn":
            arch = str(config.get("arch", "x64")).strip().lower()
            sgn_arch = "32" if arch == "x86" else "64"
            cmd = [
                str(bin_path),
                "-i",
                str(inp),
                "-o",
                str(out),
                "-a",
                sgn_arch,
                "-c",
                "1",
            ]
        else:
            cmd = [
                str(bin_path),
                "-input",
                str(inp),
                "-enc",
                "XOR",
                "-lang",
                "Raw",
                "-output",
                str(out),
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _stdout, stderr = await proc.communicate()
        code = proc.returncode or 0

        if code != 0:
            detail = stderr.decode("utf-8", errors="replace").strip()
            msg = f"{encoder} encoder failed (exit {code})"
            if detail:
                msg = f"{msg}: {detail[:500]}"
            return None, msg

        if not out.is_file() or out.stat().st_size == 0:
            return None, f"{encoder} encoder produced no output"

        return out.read_bytes(), None
    finally:
        inp.unlink(missing_ok=True)
        out.unlink(missing_ok=True)
