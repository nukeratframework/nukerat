import std/tables as tb
import ../../linapi/handlers
import ../socks/core

var portforwardFds*: Table[string, cint] = initTable[string, cint]()

proc pfConnect*(key, host: string, port: int): string =
  # Opens a port forward socket and stores it under the key
  if tb.contains(portforwardFds, key):
    return "socket exists"
  let fd = sockConnect(host, port)
  if fd < 0:
    return "connect failed"
  portforwardFds[key] = fd
  ""

proc pfRead*(cid: string, mx: int): (seq[byte], string) =
  # Reads bytes from the port forward socket for this connection
  if not tb.contains(portforwardFds, cid):
    return (@[], "unknown conn")
  (sockRead(portforwardFds[cid], mx), "")

proc pfWrite*(cid: string, data: string): string =
  # Writes data to the port forward socket for this connection
  if not tb.contains(portforwardFds, cid):
    return "unknown conn"
  sockWrite(portforwardFds[cid], data)
  ""

proc pfClose*(cid: string) =
  # Closes the port forward socket and removes it from the table
  if not tb.contains(portforwardFds, cid):
    return
  sockClose(portforwardFds[cid])
  portforwardFds.del(cid)

proc pfCloseAll*() =
  # Closes every port forward socket and clears the table
  for _, fd in portforwardFds.pairs:
    sockClose(fd)
  portforwardFds.clear()
