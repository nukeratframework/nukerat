import std/[options, strutils]
{.push warning[UnusedImport]: off.}
from ../../utils/global import obfuscationType, fromXor, fromRC4
{.pop.}
import ../../utils/winapi/handlers
import ../../utils/winapi/utils as win

include "../../macro"

const max_ports* = 1024

func top20_ports_obf(): array[20, string] =
  # Returns the top 20 port strings
  [
    obf("21"), obf("22"), obf("23"), obf("25"), obf("53"), obf("80"), obf("110"), obf("111"), obf("135"), obf("139"),
    obf("143"), obf("443"), obf("445"), obf("993"), obf("995"), obf("1723"), obf("3306"), obf("3389"), obf("5900"), obf("8080"),
  ]

func top100_ports_obf(): array[99, string] =
  # Returns the top 100 port strings
  [
    obf("7"), obf("9"), obf("13"), obf("21"), obf("22"), obf("23"), obf("25"), obf("26"), obf("37"), obf("53"), obf("79"), obf("80"), obf("81"), obf("88"), obf("106"), obf("110"), obf("111"), obf("113"), obf("119"), obf("135"),
    obf("139"), obf("143"), obf("144"), obf("179"), obf("199"), obf("389"), obf("427"), obf("443"), obf("444"), obf("445"), obf("465"), obf("513"), obf("514"), obf("515"), obf("543"), obf("544"), obf("548"),
    obf("554"), obf("587"), obf("631"), obf("646"), obf("873"), obf("990"), obf("993"), obf("995"), obf("1025"), obf("1026"), obf("1027"), obf("1028"), obf("1029"), obf("1110"), obf("1433"),
    obf("1720"), obf("1723"), obf("1755"), obf("1900"), obf("2000"), obf("2001"), obf("2049"), obf("2121"), obf("2717"), obf("3000"), obf("3128"), obf("3306"), obf("3389"), obf("3986"),
    obf("4899"), obf("5000"), obf("5009"), obf("5051"), obf("5060"), obf("5101"), obf("5190"), obf("5357"), obf("5432"), obf("5631"), obf("5666"), obf("5800"), obf("5900"), obf("6000"),
    obf("6646"), obf("7070"), obf("8000"), obf("8008"), obf("8009"), obf("8080"), obf("8081"), obf("8443"), obf("8888"), obf("9100"), obf("9999"), obf("10000"), obf("32768"), obf("49152"),
    obf("49153"), obf("49154"), obf("49155"), obf("49156"), obf("49157"),
  ]

var winsock_ready = false

proc ensure_winsock*(): bool =
  # Initializes winsock when it is not ready
  if winsock_ready:
    return true
  var wsa: WsaData
  let ver = (uint16(2) or (uint16(2) shl 8))
  if wsaStartup(ver, addr wsa) != 0:
    return false
  winsock_ready = true
  true

proc ports_from_obf(data: openArray[string]): seq[int32] =
  # Converts the obfuscated port strings into integers
  var acc: seq[int32] = @[]
  for entry in data:
    acc.add(int32(parseInt(entry)))
  acc

proc parse_uint_slice(s: string; hi: int = 65535): Option[int32] =
  # Parses a numeric string into a port number
  if s.len == 0:
    return none(int32)
  var n = 0'i32
  for ch in s:
    if ch < '0' or ch > '9':
      return none(int32)
    let d = int32(ord(ch) - ord('0'))
    if n > (hi - d) div 10:
      return none(int32)
    n = n * 10 + d
  some(n)

proc parse_ports*(spec: string): (seq[int32], string) =
  # Parses the port scan spec into a list of ports
  if spec.len == 0:
    return (@[], obf("invalid"))
  if spec == obf("top20"):
    let enc20 = top20_ports_obf()
    if enc20.len > max_ports:
      return (@[], obf("cap"))
    return (ports_from_obf(enc20), "")
  if spec == obf("top100"):
    let enc100 = top100_ports_obf()
    if enc100.len > max_ports:
      return (@[], obf("cap"))
    return (ports_from_obf(enc100), "")

  proc append_port(ports: var seq[int32]; port: int32): bool =
    # Adds the port when it is in range and under the cap
    if port < 1 or port > 65535 or ports.len >= max_ports:
      return false
    ports.add(port)
    true

  if '-' in spec:
    let dash = spec.find('-')
    let startOpt = parse_uint_slice(spec[0..<dash])
    let endOpt = parse_uint_slice(spec[dash + 1 .. ^1])
    if startOpt.isNone or endOpt.isNone:
      return (@[], obf("invalid"))
    let start = startOpt.get
    let endp = endOpt.get
    if start < 1 or endp > 65535 or start > endp:
      return (@[], obf("invalid"))
    if (endp - start + 1) > max_ports:
      return (@[], obf("cap"))
    var ports: seq[int32] = @[]
    for p in start .. endp:
      if not append_port(ports, p):
        return (@[], obf("cap"))
    return (ports, "")

  if ',' in spec or ' ' in spec:
    var ports: seq[int32] = @[]
    for part in spec.split({',', ' '}):
      let token = part.strip()
      if token.len == 0:
        continue
      let po = parse_uint_slice(token)
      if po.isNone or po.get < 1:
        return (@[], obf("invalid"))
      if not append_port(ports, po.get):
        return (@[], obf("cap"))
    if ports.len == 0:
      return (@[], obf("invalid"))
    return (ports, "")

  let single = parse_uint_slice(spec)
  if single.isSome and single.get >= 1:
    return (@[single.get], "")
  (@[], obf("invalid"))

proc resolve_target_ipv4*(host: string): Option[uint32] =
  # Resolves the host name to an ipv4 address
  if host.len == 0:
    return none(uint32)
  if not ensure_winsock():
    return none(uint32)
  let numeric = inetAddr(host.cstring)
  if numeric != inaddrNone:
    return some(numeric)
  let resolved = cast[ptr HostEnt](getHostByName(host.cstring))
  if resolved == nil:
    return none(uint32)
  if resolved.h_addrtype != win.afInet or resolved.h_length != 4:
    return none(uint32)
  if resolved.h_addr_list.isNil:
    return none(uint32)
  let first = cast[ptr UncheckedArray[pointer]](resolved.h_addr_list)[0]
  if first.isNil:
    return none(uint32)
  var ip: uint32
  copyMem(addr ip, first, 4)
  some(ip)

proc fd_set_one(sock: SocketHandle): WsaFdSet =
  # Builds a socket set that holds one socket
  var s: WsaFdSet
  s.fd_count = 1
  s.fd_array[0] = sock
  s

proc socket_is_set(sock: SocketHandle; s: WsaFdSet): bool =
  # Checks that the socket is present in the set
  s.fd_count > 0 and s.fd_array[0] == sock

proc make_sockaddr_in(target: uint32; port: int32): SockAddrIn =
  # Builds the socket address for the target and port
  var sin: SockAddrIn
  zeroMem(addr sin, sizeOf(sin))
  sin.sin_family = int16(win.afInet)
  sin.sin_port = htons(uint16(port))
  sin.sin_addr = target
  sin

proc tcp_connect_scan*(target_addr: uint32; port: int32; timeout_ms: int): int =
  # Runs a tcp connect check on one port
  if not ensure_winsock():
    return -1
  var sin = make_sockaddr_in(target_addr, port)
  let sock = ws2Socket(win.afInet, win.sockStream, win.ipprotoTcp)
  if sock == invalidSocketHandle:
    return -1
  var mode: uint32 = 1
  if ws2IoctlSocket(sock, fionbio, addr mode) == ws2SocketError:
    discard ws2CloseSocket(sock)
    return -1
  var scan_result = 0
  if ws2Connect(sock, addr sin, int32(sizeOf(sin))) == 0:
    scan_result = 1
  elif wsaGetLastError() == wsaeWouldBlock:
    var writefds = fd_set_one(sock)
    var tv: WsaTimeVal
    tv.tv_sec = int32(timeout_ms div 1000)
    tv.tv_usec = int32((timeout_ms mod 1000) * 1000)
    if ws2Select(0, nil, addr writefds, nil, addr tv) > 0 and socket_is_set(sock, writefds):
      var sock_err: int32 = 0
      var sock_err_len: int32 = int32(sizeOf(sock_err))
      if ws2GetSockOpt(sock, solSocket, soError, addr sock_err, addr sock_err_len) == 0 and sock_err == 0:
        scan_result = 1
  discard ws2CloseSocket(sock)
  scan_result

proc udp_probe*(target_addr: uint32; port: int32; timeout_ms: int): int =
  # Probes one udp port and checks for a response
  if not ensure_winsock():
    return -1
  var sin = make_sockaddr_in(target_addr, port)
  let sock = ws2Socket(win.afInet, win.sockDgram, win.ipprotoUdp)
  if sock == invalidSocketHandle:
    return -1
  var buf: array[1, byte]
  if ws2SendTo(sock, addr buf[0], 0, 0, addr sin, int32(sizeOf(sin))) == ws2SocketError:
    discard ws2CloseSocket(sock)
    return -1
  var readfds = fd_set_one(sock)
  var tv: WsaTimeVal
  tv.tv_sec = int32(timeout_ms div 1000)
  tv.tv_usec = int32((timeout_ms mod 1000) * 1000)
  var scan_result = 0
  if ws2Select(0, addr readfds, nil, nil, addr tv) > 0 and socket_is_set(sock, readfds):
    scan_result = 1
  discard ws2CloseSocket(sock)
  scan_result
