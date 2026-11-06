import random
import string
from infra.database.database import Credentials, Host, sqlite_db_sync as sqlite_db


def make_tag():
    # Builds a random tag for the credential
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(9))


def host_server(host_tag):
    # Resolves the server address of the host
    rows = sqlite_db.read(Host, tag=str(host_tag).strip())
    if not rows:
        return ""
    row = rows[0]
    server = (row.host_server or "").strip()
    port = (row.host_port or "").strip()
    if server and port:
        return f"{server}:{port}"
    if server:
        return server
    listener = (row.listener or "").strip()
    if listener:
        return listener
    return (row.ip or "").strip()


def row_dict(row):
    # Turns a credential row into a dict
    return {
        "id": row.id,
        "tag": row.tag,
        "name": row.name,
        "server": row.server,
        "host": row.host,
        "description": row.description or "",
        "content": row.content or "",
    }


class CredentialsApi:
    def __call__(self):
        # Returns every credential stored in the DB
        return [row_dict(row) for row in sqlite_db.read(Credentials)]

    def add(self, name, host, description, content):
        # Stores a new credential in the DB
        name = str(name).strip()
        host = str(host).strip()
        description = str(description).strip()
        content = str(content).strip()
        if not name or not host or not content:
            raise ValueError("name, host and password are required")
        server = host_server(host)
        if not server:
            raise ValueError("host not found")
        tag = make_tag()
        sqlite_db.write(
            Credentials(
                tag=tag,
                name=name,
                server=server,
                host=host,
                content=content,
                description=description or None,
            )
        )
        return tag

    def remove(self, tag):
        # Removes a credential from the DB
        tag = str(tag).strip()
        if not tag:
            raise ValueError("credential tag is required")
        rows = sqlite_db.read(Credentials, tag=tag)
        if not rows:
            return {"status": "failure", "message": "credential not found"}
        sqlite_db.delete(Credentials, id=rows[0].id)
        return {"status": "success", "message": "credential removed"}


credentials = CredentialsApi()
