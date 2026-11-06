import asyncio
import os
import subprocess
import tempfile

from infra.general.create_log import logger, write_log
from .validation import sanitize_cert


def apply_certs_sync(data: dict, required: bool = False) -> tuple[dict, str | None, str | None]:
    # Builds or copies the certificate and the key
    cert = data.get("cert") or {}
    if not cert.get("enabled") and not required:
        return data, None, None

    clean = sanitize_cert(cert, required=True)

    if clean["source"] == "manual":
        cert_pem, key_pem = clean["certPem"], clean["keyPem"]
    else:
        subj = (
            f"/C={clean['country']}/ST={clean['state']}/L={clean['locality']}"
            f"/O={clean['organization']}/OU={clean['orgUnit']}/CN={clean['commonName']}"
        )
        with tempfile.TemporaryDirectory() as tmp:
            cert_path = os.path.join(tmp, "cert.pem")
            key_path = os.path.join(tmp, "key.pem")
            if clean.get("keyType") == "rsa":
                newkey_args = ["-newkey", "rsa:2048"]
            else:
                newkey_args = [
                    "-newkey", "ec",
                    "-pkeyopt", "ec_paramgen_curve:P-256",
                ]
            cmd = [
                "openssl", "req", "-x509",
                *newkey_args,
                "-keyout", key_path, "-out", cert_path,
                "-sha256", "-days", str(clean["days"]), "-nodes",
                "-subj", subj,
                "-addext", f"subjectAltName=DNS:{clean['sanDns']}",
            ]
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
            except subprocess.CalledProcessError as exc:
                write_log(logger, "error", f"Unhandled exception | listeners/certs | {exc}")
                raise ValueError(exc.stderr or "openssl failed") from exc
            cert_pem = open(cert_path, encoding="utf-8").read().strip()
            key_pem = open(key_path, encoding="utf-8").read().strip()

    out = {**clean, "enabled": True, "certPem": cert_pem, "keyPem": key_pem}
    return {**data, "cert": out}, cert_pem, key_pem


async def apply_certs(data: dict, required: bool = False) -> tuple[dict, str | None, str | None]:
    # Runs the certificate setup in a thread
    return await asyncio.to_thread(apply_certs_sync, data, required)
