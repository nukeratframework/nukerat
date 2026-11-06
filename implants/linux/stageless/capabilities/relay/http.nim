import std/json
import ../../utils/network/http_core
import ../../utils/network/relay_packet

proc relayHttpForwardDestiny*(_: JsonNode, contentBody: string): string =
  # Forwards the content through the http relay and builds the envelope
  if contentBody.len == 0:
    return ""
  try:
    let resp = http_core.relay_call(contentBody)
    if not resp.ok or resp.code != 200 or resp.body.len == 0:
      return ""
    let content = relayPipeContent(parseJson(resp.body))
    result = buildEnvelope(content)
  except JsonParsingError:
    result = ""
  except CatchableError:
    result = ""
