import builtins
import json
import os
import sys
import threading


class ScriptRow(dict):
    def __getitem__(self, key):
        # Returns the key or None when it is missing
        return self.get(key)


class Api:
    def __init__(self, path, rpc):
        # Class init, stores the path and the rpc callback
        self._path = path
        self._rpc = rpc

    def __call__(self, *args, **kwargs):
        # Calls the parent through rpc with the stored path
        return self._rpc(self._path, args, kwargs)

    def __getattr__(self, item):
        # Builds a nested api for the next attribute
        if item.startswith("_"):
            raise AttributeError(item)
        return Api(f"{self._path}.{item}", self._rpc)


def main():
    # Entrypoint of the sandbox child, runs the script
    fh = os.fdopen(int(sys.argv[1]), "r+b", buffering=0)
    lock = threading.Lock()
    ident = 0

    def read():
        # Reads one JSON line from the parent
        line = fh.readline()
        if not line:
            raise EOFError("sandbox parent closed")
        return json.loads(line)

    def write(payload):
        # Sends one JSON line to the parent
        fh.write(json.dumps(payload).encode() + b"\n")

    def rpc(name, args, kwargs):
        # Sends a native call and waits for the reply
        nonlocal ident
        with lock:
            ident += 1
            current = ident
            write({"id": current, "name": name, "args": args, "kwargs": kwargs})
            reply = read()
        if reply.get("id") != current or not reply.get("ok"):
            exc_type = getattr(builtins, reply.get("type") or "", RuntimeError)
            if not isinstance(exc_type, type) or not issubclass(exc_type, Exception):
                exc_type = RuntimeError
            raise exc_type(reply.get("error") or "native call failed")
        return reply.get("result")

    start = read()
    namespace = {"evt": ScriptRow(start.get("evt") or {}), "__name__": "__nukescript__"}
    for key in start.get("names") or []:
        namespace[key] = Api(key, rpc)
    try:
        code = compile(start.get("code") or "", f"<script:{start.get('name', '?')}>", "exec")
        exec(code, namespace)
    except Exception as exc:
        write({"op": "error", "error": f"{type(exc).__name__}: {exc}"})
        return
    write({"op": "done"})


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.stderr.write(f"{exc}\n")
        sys.exit(1)
