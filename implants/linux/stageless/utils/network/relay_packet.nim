import std/[json, strutils]
import ../global
import ../general/strings
type TransportResponse* = object
  ok*: bool
  code*: uint16
  body*: string
  err*: string

proc transportFail*(reason: string): TransportResponse =
  # Builds a failed transport response with the given reason
  TransportResponse(ok: false, code: 0'u16, body: "", err: reason)

proc buildEnvelope*(content: JsonNode): string =
  # Builds a relay envelope with source, content, and chain
  result = $(%*{
    (obf("source")): hostTag,
    (obf("content")): content,
    (obf("chain")): %*[hostTag],
  })

proc extendEnvelope*(packet: JsonNode): string =
  # Appends this host to the chain and returns the packet text
  var chain =
    if packet.hasKey(obf("chain")) and packet[obf("chain")].kind == JArray:
      copy(packet[obf("chain")])
    else:
      newJArray()
  add(chain, %hostTag)
  let chainKey = obf("chain")
  var payload = newJObject()
  if packet.kind == JObject:
    for k, v in packet.pairs:
      if k != chainKey:
        payload.add k, copy(v)
  payload.add chainKey, chain
  result = $(payload)

proc relayIsOutputItem*(node: JsonNode): bool =
  # Checks that the node is an output item
  node.kind == JObject and node.hasKey(obf("option")) and
    node[obf("option")].getStr() == obf("output")

proc relayPipeContent*(content: JsonNode): JsonNode =
  # Normalizes relay content so output items become an empty command list
  if content.kind == JObject and content.hasKey(obf("commands")):
    return content
  if content.kind == JArray:
    for item in content:
      if relayIsOutputItem(item):
        return %*{(obf("commands")): %*[]}
    return content
  if relayIsOutputItem(content):
    return %*{(obf("commands")): %*[]}
  content

proc relayNormalizeFrame*(frame: string): string =
  # Normalizes the content inside a relay frame
  if frame.len == 0:
    return ""
  try:
    let pkt = parseJson(frame)
    if pkt.kind != JObject or not pkt.hasKey(obf("content")):
      return frame
    let norm = relayPipeContent(pkt[obf("content")])
    if $norm == $(pkt[obf("content")]):
      return frame
    var frameOut = pkt
    frameOut[obf("content")] = norm
    result = $(frameOut)
  except JsonParsingError:
    return frame

proc parseTransportResponse*(raw: string): TransportResponse =
  # Parses a raw frame into a transport response
  if raw.len == 0:
    return transportFail(obf("empty_frame"))
  try:
    let pkt = parseJson(raw)
    if pkt.kind != JObject:
      return transportFail(obf("invalid_envelope: not_object rawLen=") & $raw.len)
    if not pkt.hasKey(obf("content")):
      return transportFail(obf("invalid_envelope: missing_content keys=") & jsonKeysList(pkt))
    result = TransportResponse(ok: true, code: 200'u16, body: $(pkt[obf("content")]), err: "")
  except JsonParsingError as e:
    result = transportFail(obf("json_parse_error: ") & e.msg & obf(" rawPreview=") & clipText(raw))
  except CatchableError as e:
    result = transportFail(obf("parse_error: ") & e.msg)

proc hasCommands*(resp: TransportResponse): bool =
  # Checks that the transport response contains at least one command
  if not resp.ok or resp.body.len == 0:
    return false
  try:
    let data = parseJson(resp.body)
    if data.kind != JObject or not data.hasKey(obf("commands")):
      return false
    for _ in data[obf("commands")]:
      return true
    false
  except JsonParsingError:
    false

