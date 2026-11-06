import ../global
import std/json
import std/md5
import std/parseutils
import std/strutils
import std/tables

proc rdLe32*(data: openArray[byte]; off: int): culong {.inline.} =
  cast[ptr culong](unsafeAddr data[off])[]

proc rdLe16*(data: openArray[byte]; off: int): uint16 {.inline.} =
  cast[ptr uint16](unsafeAddr data[off])[]

proc asciiWide*(src: string; dst: var openArray[uint16]) =
  for i, c in src: dst[i] = uint16(ord(c))
  dst[src.len] = 0'u16

proc wtoa*(w: openArray[uint16]; buf: var openArray[char]): int =
  result = 0
  while result < w.len and w[result] != 0'u16 and result < buf.len:
    buf[result] = char(w[result])
    inc result

proc wideToAscii*(data: pointer; byteLen: culong): string =
  let w = cast[ptr UncheckedArray[uint16]](data)
  var i = 0
  while i < byteLen.int div 2:
    let c = w[i]
    if c == 0:
      break
    result.add char(c)
    i += 1

proc digestHex*(s: string): string =
  getMD5(s)

proc tagFromSource*(src: string): string =
  var clean = ""
  for c in src:
    if c in {'0'..'9', 'a'..'f', 'A'..'F'}:
      clean.add c
  if clean.len < 5:
    clean = digestHex(src)
  if clean.len < 5:
    return "00000"
  clean[0 .. 4]

proc fmtU64*(n: uint64; buf: var openArray[char]): int =
  if n == 0:
    if buf.len == 0: return -1
    buf[0] = '0'
    return 1
  var tmp: array[24, char]
  var d = 0
  var v = n
  while v > 0:
    tmp[d] = char(ord('0') + int(v mod 10))
    v = v div 10
    inc d
  if d > buf.len: return -1
  for i in 0 ..< d: buf[i] = tmp[d - 1 - i]
  d

proc fmtSystemTime*(st: openArray[byte]; buf: var openArray[char]): int =
  if buf.len < 19: return -1
  var pos = 0
  var y = rdLe16(st, 0)
  for i in 0 ..< 4:
    buf[pos + (3 - i)] = char(ord('0') + int(y mod 10))
    y = y div 10
  pos += 4
  buf[pos] = '-'; inc pos
  var n = rdLe16(st, 2)
  buf[pos] = char(ord('0') + int(n div 10))
  buf[pos + 1] = char(ord('0') + int(n mod 10))
  pos += 2
  buf[pos] = '-'; inc pos
  n = rdLe16(st, 6)
  buf[pos] = char(ord('0') + int(n div 10))
  buf[pos + 1] = char(ord('0') + int(n mod 10))
  pos += 2
  buf[pos] = ' '; inc pos
  n = rdLe16(st, 8)
  buf[pos] = char(ord('0') + int(n div 10))
  buf[pos + 1] = char(ord('0') + int(n mod 10))
  pos += 2
  buf[pos] = ':'; inc pos
  n = rdLe16(st, 10)
  buf[pos] = char(ord('0') + int(n div 10))
  buf[pos + 1] = char(ord('0') + int(n mod 10))
  pos += 2
  buf[pos] = ':'; inc pos
  n = rdLe16(st, 12)
  buf[pos] = char(ord('0') + int(n div 10))
  buf[pos + 1] = char(ord('0') + int(n mod 10))
  pos += 2
  pos

proc fmtSize*(sz: uint64; buf: var openArray[char]): int =
  const kb = 1024'u64
  const mb = kb * 1024
  const gb = mb * 1024
  if sz < kb:
    let n = fmtU64(sz, buf)
    if n < 0: return -1
    if n + 2 > buf.len: return -1
    buf[n] = ' '; buf[n + 1] = 'B'
    return n + 2
  let divv = if sz < mb: kb elif sz < gb: mb else: gb
  let whole = sz div divv
  let frac = (sz mod divv) * 10 div divv
  var pos = fmtU64(whole, buf)
  if pos < 0: return -1
  if pos + 5 > buf.len: return -1
  buf[pos] = '.'
  buf[pos + 1] = char(ord('0') + int(frac))
  buf[pos + 2] = ' '
  buf[pos + 3] = if sz < mb: 'K' elif sz < gb: 'M' else: 'G'
  buf[pos + 4] = 'B'
  pos + 5

proc appendStr*(buf: var openArray[char]; pos: var int; s: string): bool =
  if pos + s.len > buf.len: return false
  if s.len > 0: copyMem(addr buf[pos], unsafeAddr s[0], s.len)
  pos += s.len
  true

proc appendByte*(buf: var openArray[char]; pos: var int; c: char): bool =
  if pos >= buf.len: return false
  buf[pos] = c; inc pos; true

proc appendCol*(buf: var openArray[char]; pos: var int; s: string; width: int; right: bool): bool =
  if pos + width > buf.len: return false
  if s.len >= width:
    let start = if right: s.len - width else: 0
    copyMem(addr buf[pos], unsafeAddr s[start], width)
  elif right:
    for i in 0 ..< width - s.len: buf[pos + i] = ' '
    if s.len > 0: copyMem(addr buf[pos + width - s.len], unsafeAddr s[0], s.len)
  else:
    if s.len > 0: copyMem(addr buf[pos], unsafeAddr s[0], s.len)
    for i in s.len ..< width: buf[pos + i] = ' '
  pos += width; true

proc appendWcs*(buf: var openArray[char]; pos: var int; w: ptr UncheckedArray[uint16]; max: int): bool =
  var i = 0
  while i < max and w[i] != 0'u16:
    if pos >= buf.len: return false
    buf[pos] = char(w[i]); inc pos; inc i
  true

proc clipText*(s: string; n = 512): string =
  if s.len <= n: s else: s[0 ..< n] & obf("...")

proc jsonKeysList*(pkt: JsonNode): string =
  var keys: seq[string] = @[]
  if pkt.kind == JObject:
    for k, _ in pkt.pairs:
      keys.add k
  "[" & keys.join(",") & "]"

proc frameLog*(frame: string): string =
  if frame.len == 0:
    return ""
  try:
    let pkt = parseJson(frame)
    if pkt.kind != JObject:
      return clipText(frame, 50)
    let contentKey = obf("content")
    if not pkt.hasKey(contentKey):
      return frame
    var logged = newJObject()
    for k, v in pkt.pairs:
      if k == contentKey:
        logged.add k, %clipText($(pkt[contentKey]), 50)
      else:
        logged.add k, copy(v)
    $(logged)
  except CatchableError:
    clipText(frame, 50)

proc parsePortDigits*(s: string): int =
  result = 0
  var got = false
  for c in s:
    if c < '0' or c > '9':
      break
    got = true
    result = result * 10 + ord(c) - ord('0')
  if not got or result <= 0 or result > 65535:
    return 0

proc parsePortInt*(raw: string): int =
  var port = 0
  if parseInt(raw.strip(), port) > 0 and port > 0 and port <= 65535:
    port
  else:
    0

proc pipePathValid*(raw: string): bool =
  raw.strip().len > 0

proc pipeNormalize*(raw: string): string =
  let v = raw.strip()
  if v.len == 0:
    return ""
  let plainPrefix = obf(r"\\pipe\")
  if v.len >= plainPrefix.len and v[0 ..< plainPrefix.len].toLowerAscii() == plainPrefix.toLowerAscii():
    return v
  return plainPrefix & v

proc pipeLocalFromRaw*(raw: string): string =
  let v = raw.strip()
  if v.len == 0:
    return ""
  let dotPrefix = obf(r"\\.\pipe\")
  let plainPrefix = obf(r"\\pipe\")
  if v.len >= dotPrefix.len and v[0 ..< dotPrefix.len].toLowerAscii() == dotPrefix.toLowerAscii():
    return v
  if v.len >= plainPrefix.len and v[0 ..< plainPrefix.len].toLowerAscii() == plainPrefix.toLowerAscii():
    return dotPrefix & v[plainPrefix.len .. ^1]
  return dotPrefix & v

proc pipeRemoteFromRaw*(raw: string; destinyHost: string): string =
  let v = raw.strip()
  if v.len == 0 or destinyHost.len == 0:
    return ""
  let remotePrefix = obf(r"\\") & destinyHost & obf(r"\pipe\")
  let dotPrefix = obf(r"\\.\pipe\")
  let plainPrefix = obf(r"\\pipe\")
  if v.len >= plainPrefix.len and v[0 ..< plainPrefix.len].toLowerAscii() == plainPrefix.toLowerAscii():
    return remotePrefix & v[plainPrefix.len .. ^1]
  if v.len >= dotPrefix.len and v[0 ..< dotPrefix.len].toLowerAscii() == dotPrefix.toLowerAscii():
    return remotePrefix & v[dotPrefix.len .. ^1]
  return remotePrefix & v

proc pipePaths*(host, pipePath: string): (string, string) =
  result[0] = pipeLocalFromRaw(pipePath)
  result[1] = pipeRemoteFromRaw(pipePath, host)

proc targetSchemeParts*(raw: string): (string, string) =
  let v = raw.strip()
  let schemeSep = obf("://")
  let idx = v.find(schemeSep)
  if idx > 0:
    return (v[0 ..< idx].toLowerAscii(), v[idx + schemeSep.len .. ^1].strip())
  (obf("implant"), v)

proc parseHostPort*(raw: string; defaultPort: int): (string, int) =
  var value = raw.strip()
  if value.len == 0:
    return ("", 0)
  let slash = value.find('/')
  if slash > 0:
    value = value[0 ..< slash]
  var host = value
  var port = defaultPort
  let colon = value.rfind(':')
  if colon > 0:
    let maybePort = value[colon + 1 .. ^1]
    var parsed = 0
    if parseInt(maybePort, parsed) > 0 and parsed > 0 and parsed <= 65535:
      host = value[0 ..< colon]
      port = parsed
  (host.strip(), port)

proc parseRelayEndpoint*(raw: string; transport: string): JsonNode =
  let defaultPort = if transport == obf("smb"): 445 else: 0
  let (host, port) = parseHostPort(raw, defaultPort)
  %*{(obf("scheme")): transport, (obf("host")): %host, (obf("port")): %port}

proc argsColonTable*(raw: string): Table[string, string] =
  var tbl = initTable[string, string]()
  if raw.len == 0:
    return tbl
  for token in raw.splitWhitespace():
    let idx = token.find(':')
    if idx <= 0:
      continue
    tbl[token[0 ..< idx].toLowerAscii()] = token[idx + 1 .. ^1]
  tbl
