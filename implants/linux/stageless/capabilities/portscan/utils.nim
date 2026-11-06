import std/[options, strutils]
import ../../utils/linapi/handlers

const obfuscationType = "<obfuscationType>"
from ../../utils/crypt/xordec import fromXor
from ../../utils/crypt/rc4 import fromRC4
include "../../macro"

const max_ports* = 1024

func top20_ports_obf(): array[20, string] =
  # Returns the obfuscated list of the top 20 ports
  [
  obf("21"), obf("22"), obf("23"), obf("25"), obf("53"), obf("80"), obf("110"), obf("111"), obf("135"), obf("139"),
  obf("143"), obf("443"), obf("445"), obf("993"), obf("995"), obf("1723"), obf("3306"), obf("3389"), obf("5900"), obf("8080")
]

func top100_ports_obf(): array[99, string] =
  # Returns the obfuscated list of the top 100 ports
  [
  obf("7"), obf("9"), obf("13"), obf("21"), obf("22"), obf("23"), obf("25"), obf("26"), obf("37"), obf("53"), obf("79"), obf("80"), obf("81"), obf("88"), obf("106"), obf("110"), obf("111"), obf("113"), obf("119"), obf("135"),
  obf("139"), obf("143"), obf("144"), obf("179"), obf("199"), obf("389"), obf("427"), obf("443"), obf("444"), obf("445"), obf("465"), obf("513"), obf("514"), obf("515"), obf("543"), obf("544"), obf("548"),
  obf("554"), obf("587"), obf("631"), obf("646"), obf("873"), obf("990"), obf("993"), obf("995"), obf("1025"), obf("1026"), obf("1027"), obf("1028"), obf("1029"), obf("1110"), obf("1433"),
  obf("1720"), obf("1723"), obf("1755"), obf("1900"), obf("2000"), obf("2001"), obf("2049"), obf("2121"), obf("2717"), obf("3000"), obf("3128"), obf("3306"), obf("3389"), obf("3986"),
  obf("4899"), obf("5000"), obf("5009"), obf("5051"), obf("5060"), obf("5101"), obf("5190"), obf("5357"), obf("5432"), obf("5631"), obf("5666"), obf("5800"), obf("5900"), obf("6000"),
  obf("6646"), obf("7070"), obf("8000"), obf("8008"), obf("8009"), obf("8080"), obf("8081"), obf("8443"), obf("8888"), obf("9100"), obf("9999"), obf("10000"), obf("32768"), obf("49152"),
  obf("49153"), obf("49154"), obf("49155"), obf("49156"), obf("49157")
]

proc ports_from_obf(data: openArray[string]): seq[int32] =
  # Converts the obfuscated port strings into integers
  var acc: seq[int32] = @[]
  for entry in data:
    acc.add(int32(parseInt(entry)))
  acc

proc parse_uint_slice(s: string; hi: int = 65535): Option[int32] =
  # Parses a numeric string into an integer inside the given limit
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

proc parse_ports*(spec: string): (seq[int32], cstring) =
  # Parses a port scan spec into a list of ports
  if spec.len == 0:
    return (@[], "invalid")
  if spec == "top20":
    let enc20 = top20_ports_obf()
    if enc20.len > max_ports:
      return (@[], "cap")
    return (ports_from_obf(enc20), nil)
  if spec == "top100":
    let enc100 = top100_ports_obf()
    if enc100.len > max_ports:
      return (@[], "cap")
    return (ports_from_obf(enc100), nil)

  proc append_port(ports: var seq[int32]; port: int32): bool =
    # Appends a port when it is valid and under the cap
    if port < 1 or port > 65535 or ports.len >= max_ports:
      return false
    ports.add(port)
    true

  if '-' in spec:
    let dash = spec.find('-')
    let startOpt = parse_uint_slice(spec[0..<dash])
    let endOpt = parse_uint_slice(spec[dash + 1 .. ^1])
    if startOpt.isNone or endOpt.isNone:
      return (@[], "invalid")
    let start = startOpt.get
    let endp = endOpt.get
    if start < 1 or endp > 65535 or start > endp:
      return (@[], "invalid")
    if (endp - start + 1) > max_ports:
      return (@[], "cap")
    var ports: seq[int32] = @[]
    for p in start .. endp:
      if not append_port(ports, p):
        return (@[], "cap")
    return (ports, nil)

  if ',' in spec or ' ' in spec:
    var ports: seq[int32] = @[]
    for part in spec.split({',', ' '}):
      let token = part.strip()
      if token.len == 0:
        continue
      let po = parse_uint_slice(token)
      if po.isNone or po.get < 1:
        return (@[], "invalid")
      if not append_port(ports, po.get):
        return (@[], "cap")
    if ports.len == 0:
      return (@[], "invalid")
    return (ports, nil)

  let single = parse_uint_slice(spec)
  if single.isSome and single.get >= 1:
    return (@[single.get], nil)
  (@[], "invalid")

proc resolve_target*(host: string): bool =
  # Checks that the target host resolves
  if host.len == 0:
    return false
  var hints = AddrInfo(aiFamily: afInet, aiSocktype: sockStream)
  var res: ptr AddrInfo = nil
  if getaddrinfo(host.cstring, nil, addr hints, res) != 0:
    return false
  freeAddrInfo(res)
  true

proc lookup_sockaddr*(host: string; port: int32; sockType, proto: cint): (ptr AddrInfo, bool) =
  # Looks up the socket address for the host and port
  var hints = AddrInfo(
    aiFamily: afInet,
    aiSocktype: sockType,
    aiProtocol: proto
  )
  var res: ptr AddrInfo = nil
  let sport = $port
  if getaddrinfo(host.cstring, sport.cstring, addr hints, res) != 0:
    return (nil, false)
  (res, true)

proc tcp_connect_scan*(host: string; port: int32; timeout_ms: int): int =
  # Tries a tcp connect to the host and port and returns the result code
  let (res, ok) = lookup_sockaddr(host, port, sockStream, ipprotoTcp)
  if not ok or res == nil:
    return -1
  defer:
    freeAddrInfo(res)
  let s = osSocket(res.aiFamily, res.aiSocktype, res.aiProtocol)
  if s == socketInvalidFd:
    return -1
  var flags = osFcntl(s, fGetfl, 0)
  if flags < 0:
    closeFd(s)
    return -1
  discard osFcntl(s, fSetfl, flags or oNonblock)
  let cr = osConnect(s, res.aiAddr, res.aiAddrlen)
  if cr == 0:
    closeFd(s)
    return 1
  if getErrno() != einprogress:
    closeFd(s)
    return 0
  var pfd: Pollfd
  pfd.fd = s
  pfd.events = pollOut
  if osPoll(addr pfd, 1, cint(timeout_ms)) <= 0:
    closeFd(s)
    return 0
  var sockErr: cint = 0
  var sockErrLen = cuint(sizeof(sockErr))
  if osGetsockopt(s, solSocket, soError, addr sockErr, addr sockErrLen) != 0 or sockErr != 0:
    closeFd(s)
    return 0
  closeFd(s)
  1

proc udp_probe*(host: string; port: int32; timeout_ms: int): int =
  # Sends an empty udp probe and returns whether the port answered
  let (res, ok) = lookup_sockaddr(host, port, sockDgram, ipprotoUdp)
  if not ok or res == nil:
    return -1
  defer:
    freeAddrInfo(res)
  let s = osSocket(res.aiFamily, res.aiSocktype, res.aiProtocol)
  if s == socketInvalidFd:
    return -1
  setSockRecvTimeout(s, timeout_ms)
  if osSendto(s, nil, 0, 0, res.aiAddr, res.aiAddrlen) < 0:
    closeFd(s)
    return -1
  var buf: array[1, byte]
  if osRecv(s, addr buf[0], 1, 0) > 0:
    closeFd(s)
    return 1
  closeFd(s)
  0
