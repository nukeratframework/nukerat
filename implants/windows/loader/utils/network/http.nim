import std/strutils
import ../global
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

proc parseUrl*(raw: string): UrlParts =
  # Parses a raw url into scheme, host, port and path
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
  # Converts a string into a null terminated wide buffer
  result = newSeq[uint16](s.len + 1)
  for i, c in s:
    result[i] = uint16(c)
  result[s.len] = 0

proc buildHeaderBlock(pairs: openArray[(string, string)]): string =
  # Builds the header text from name and value pairs
  for (k, v) in pairs:
    result &= k & ": " & v & "\r\n"

proc winHttpPerform*(
    urlStr: string;
    verb: string;
    body: string;
    extraHeaders: openArray[(string, string)];
): tuple[ok: bool, code: uint16, body: string] =
  # Here is where the http request is sent and the response body is read
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
  var buf = newString(8192)
  var total = 0
  while true:
    var bytesRead = culong(0)
    if winHttpReadData(hRequest, addr buf[total], culong(buf.len - total), addr bytesRead) == 0:
      return
    total += int(bytesRead)
    if bytesRead == 0:
      break
    if total == buf.len:
      buf.setLen(buf.len * 2)
  buf.setLen(total)
  result.body = buf
  result.ok = true

proc buildHeaders(): seq[(string, string)] =
  # Builds the default request headers
  @[(obf("Connection"), obf("close"))]

proc httpGetRaw*(): HttpResponse =
  # Main function that performs a raw http get
  if url.len == 0:
    return HttpResponse()
  let headers = buildHeaders()
  let r = winHttpPerform(url, "GET", "", headers)
  if not r.ok:
    return HttpResponse()
  HttpResponse(ok: true, code: r.code, body: r.body)
