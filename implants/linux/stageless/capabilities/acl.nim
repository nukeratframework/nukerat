import std/strutils
from posix import Stat
import ../utils/global
import ../utils/linapi/handlers
import ../utils/msg

proc run_acl*(args: string; buf: var openArray[char]): int =
  # Builds an access control report for a path
  let path = args.strip()
  if path.len == 0:
    return writeErr(obf("missing path"), buf)
  var st: Stat
  if not pathStat(path, st):
    return writeErr(obf("path not found"), buf)
  var report = obf("path: ") & path & '\n'
  report.add obf("owner: ") & formatProcessUser(st.st_uid.int) & '\n'
  report.add obf("group: ") & formatProcessGroup(st.st_gid.int) & '\n'
  var faclBuf: array[65536, char]
  let n = execPosix(obf("getfacl -cp --"), path, faclBuf)
  if n <= 0:
    report.add obf("dacl: (none)\n")
    return writeMsg(report, buf)
  var text = newString(n)
  copyMem(addr text[0], addr faclBuf[0], n)
  var hasEntry = false
  var body = report
  body.add obf("dacl:\n")
  for line in text.splitLines():
    var raw = line.strip()
    if raw.len == 0 or raw.startsWith(obf("#")) or raw.startsWith(obf("default:")):
      continue
    var kind = ""
    if raw.startsWith(obf("user:")):
      kind = obf("user")
      raw = raw[obf("user:").len .. ^1]
    elif raw.startsWith(obf("group:")):
      kind = obf("group")
      raw = raw[obf("group:").len .. ^1]
    elif raw.startsWith(obf("mask:")):
      kind = obf("mask")
      raw = raw[obf("mask:").len .. ^1]
    elif raw.startsWith(obf("other:")):
      kind = obf("other")
      raw = raw[obf("other:").len .. ^1]
    else:
      body.add(obf("  [ACE] mask=0x") & toHex(culong(0), 8) & obf(" sid=") & line.strip() & '\n')
      hasEntry = true
      continue
    let colon = raw.rfind(':')
    if colon < 0:
      body.add(obf("  [ACE] mask=0x") & toHex(culong(0), 8) & obf(" sid=") & kind & '\n')
      hasEntry = true
      continue
    let name = raw[0 ..< colon]
    let perm = raw[colon + 1 .. ^1]
    var mask: culong = 0
    for c in perm:
      case c
      of 'r': mask = mask or culong(4)
      of 'w': mask = mask or culong(2)
      of 'x': mask = mask or culong(1)
      else: discard
    var sid = kind
    if name.len > 0:
      sid = kind & ':' & name
    body.add(obf("  [ALLOW] mask=0x") & toHex(mask, 8) & obf(" sid=") & sid & '\n')
    hasEntry = true
  if not hasEntry:
    report.add obf("dacl: (none)\n")
    writeMsg(report, buf)
  else:
    writeMsg(body, buf)
