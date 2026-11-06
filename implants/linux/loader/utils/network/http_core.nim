from std/httpclient import HttpClient, newHttpClient, newHttpHeaders, get, code, body, close
from std/strutils import startsWith
from std/net import newContext, CVerifyNone
import ../global

type HttpResponse* = object
  ok*: bool
  code*: uint16
  body*: string

proc httpGetRaw*(): HttpResponse =
  # Main function that performs an http get and returns the raw response
  if url.len == 0:
    return HttpResponse()
  var client: HttpClient
  if url.startsWith(obf("https://")):
    client = newHttpClient(userAgent = obf(""), sslContext = newContext(verifyMode = CVerifyNone))
  else:
    client = newHttpClient(userAgent = obf(""))
  defer:
    close(client)
  client.headers = newHttpHeaders({obf("Connection"): obf("close")})
  try:
    let resp = get(client, url)
    HttpResponse(ok: true, code: uint16(code(resp)), body: body(resp))
  except CatchableError:
    HttpResponse()
