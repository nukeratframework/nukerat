import asyncio
import base64
from pproxy.server import ProxyDirect, SOCKET_TIMEOUT
from .queue_bridge import get_bridge

class BeaconRemote(ProxyDirect):
    def __init__(self, host_tag: str):
        # Class init, stores the beacon host tag for this remote
        super().__init__()
        self.host_tag = host_tag
        self.bind = "BEACON"

    @property
    def direct(self):
        # Marks this remote as not a direct socket connection
        return False

    def logtext(self, host, port):
        # Builds the log line that names the beacon host and port
        return f" -> beacon:{self.host_tag} {host}:{port}"

    async def open_connection(self, host, port, local_addr, lbind, timeout=SOCKET_TIMEOUT):
        # Asks the beacon to open a connection and returns reader and writer
        bridge = get_bridge()
        result = await bridge.call(self.host_tag, "connect", {"host": host, "port": int(port)})
        if not result.get("ok"):
            raise Exception(result.get("error", "connect failed"))
        conn_id = result.get("conn_id", "")
        if not conn_id:
            raise Exception("missing conn_id")
        return BeaconReader(self.host_tag, conn_id), BeaconWriter(self.host_tag, conn_id)


class BeaconReader:
    def __init__(self, host_tag: str, conn_id: str):
        # Class init, stores the reader host tag and connection id
        self.host_tag = host_tag
        self.conn_id = conn_id
        self.eof = False

    def at_eof(self):
        # Returns whether the beacon reader has reached the end
        return self.eof

    async def read(self, n=-1):
        # Reads bytes by calling the beacon read helper
        return await self.read_w(n)

    async def read_w(self, n=-1):
        # Pulls a chunk from the beacon and sets the end flag when it is empty
        if self.eof:
            return b""
        bridge = get_bridge()
        mx = 65536 if n is None or n < 0 else n
        result = await bridge.call(self.host_tag, "read", {"conn_id": self.conn_id, "max": mx})
        if not result.get("ok"):
            self.eof = True
            return b""
        data = base64.b64decode(result.get("data") or "")
        if not data:
            self.eof = True
        return data

    def rollback(self, s):
        # Rollback hook, does nothing for the beacon reader
        pass


class BeaconWriter:
    def __init__(self, host_tag: str, conn_id: str):
        # Class init, stores the writer host tag and connection id
        self.host_tag = host_tag
        self.conn_id = conn_id
        self.closed = False

    def write(self, data):
        # Schedules a beacon write so the caller does not block
        if self.closed or not data:
            return
        asyncio.get_event_loop().create_task(self.drain_write(data))

    async def drain_write(self, data):
        # Sends the encoded bytes to the beacon connection
        bridge = get_bridge()
        await bridge.call(self.host_tag, "write", {
            "conn_id": self.conn_id,
            "data": base64.b64encode(data).decode(),
        })

    async def drain(self):
        # Drain hook, does nothing for the beacon writer
        pass

    def is_closing(self):
        # Returns whether the beacon writer is already closed
        return self.closed

    def close(self):
        # Marks the writer closed and asks the beacon to close the connection
        if self.closed:
            return
        self.closed = True
        bridge = get_bridge()
        asyncio.get_event_loop().create_task(
            bridge.call(self.host_tag, "close", {"conn_id": self.conn_id})
        )

    def get_extra_info(self, name, default=None):
        # Returns the default extra info value for this writer
        return default
