import std/tables
import ../../linapi/handlers

var socksFds*: Table[string, cint] = initTable[string, cint]()

proc sockConnect*(host: string, port: int): cint =
  # Opens a TCP socket and connects it to the host and port
  var hints = AddrInfo(
    aiFamily: afInet,
    aiSocktype: sockStream,
    aiProtocol: ipprotoTcp
  )
  var res: ptr AddrInfo = nil
  let sport = $port
  if getaddrinfo(host.cstring, sport.cstring, addr hints, res) != 0:
    return socketInvalidFd
  defer:
    if res != nil:
      freeAddrInfo(res)
  let s = osSocket(res.aiFamily, res.aiSocktype, res.aiProtocol)
  if s == socketInvalidFd:
    return socketInvalidFd
  if osConnect(s, res.aiAddr, res.aiAddrlen) != 0:
    closeFd(s)
    return socketInvalidFd
  s

proc sockRead*(fd: cint, maxBytes: int): seq[byte] =
  # Reads up to the given number of bytes from the socket
  var buf = newSeq[byte](maxBytes)
  let n = osRecv(fd, addr buf[0], maxBytes.csize_t, 0)
  if n <= 0:
    return @[]
  buf.setLen(n.int)
  buf

proc sockWrite*(fd: cint, data: string) =
  # Writes the data string to the socket
  if data.len == 0:
    return
  discard osSend(fd, unsafeAddr data[0], data.len.csize_t, 0)

proc sockClose*(fd: cint) =
  # Closes the socket
  closeFd(fd)
