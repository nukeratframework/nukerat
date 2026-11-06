import std/json
import ../../utils/global
import ../../utils/network/relay_packet
from ./http import relayHttpForwardDestiny
from ./http_custom import relayHttpCustomForwardDestiny

proc processRelayFrame*(cfg: JsonNode, frame: string, forward: proc (cfg: JsonNode, body: string): string {.nimcall.}): string =
  # Parses a relay frame and forwards it toward the destiny
  if frame.len == 0:
    return ""
  try:
    let packet = parseJson(frame)
    if packet.kind != JObject or not packet.hasKey(obf("source")) or not packet.hasKey(obf("content")):
      return ""
    if cfg[obf("destinyKind")].getStr() == obf("server"):
      if channel == obf("custom"):
        result = relayHttpCustomForwardDestiny(cfg, $(packet[obf("content")]))
      else:
        result = relayHttpForwardDestiny(cfg, $(packet[obf("content")]))
    else:
      result = forward(cfg, extendEnvelope(packet))
    return relayNormalizeFrame(result)
  except JsonParsingError:
    return ""
  except CatchableError:
    return ""
