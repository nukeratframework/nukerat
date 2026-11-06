import base64
import secrets

from infra.database.database import AesKeys, sqlite_db
from utils.querys import generate_tag


async def create_aes_key():
    # Creates an aes key and stores it
    tag = generate_tag()
    key = base64.b64encode(secrets.token_bytes(32)).decode()
    await sqlite_db.write(AesKeys(tag=tag, key=key))
    return {"status": "success", "tag": tag, "aesKey": key}
