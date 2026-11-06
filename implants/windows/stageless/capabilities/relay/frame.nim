import std/json
import ../../utils/global
import ../../utils/network/relay_packet
from ./http import relayHttpForwardDestiny
from ./http_custom import relayHttpCustomForwardDestiny

proc processRelayFrame*(cfg: JsonNode, frame: string, forward: proc (cfg: JsonNode, body: string): string {.nimcall.}): string =
  # Here is where the relay frame is parsed and forwarded
  if frame.len == 0:
    return ""
  try:
    let packet = parseJson(frame)
    if packet.kind != JObject:
      return ""
    if not packet.hasKey(obf("source")):
      return ""
    if not packet.hasKey(obf("content")):
      return ""
    let contentStr = $(packet[obf("content")])
    if cfg[obf("destinyKind")].getStr() == obf("server"):
      if channel == obf("custom"):
        result = relayHttpCustomForwardDestiny(cfg, contentStr)
      else:
        result = relayHttpForwardDestiny(cfg, contentStr)
    else:
      let extended = extendEnvelope(packet)
      result = forward(cfg, extended)
    return relayNormalizeFrame(result)
  except JsonParsingError:
    return ""
  except CatchableError:
    return ""
