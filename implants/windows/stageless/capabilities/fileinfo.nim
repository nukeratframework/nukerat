import std/strutils
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import execution/core

proc run_fileinfo*(args: string; buf: var openArray[char]): int =
  # Builds a file info report for a path
  let path = args.strip()
  if path.len == 0:
    return writeErr(obf("missing path"), buf)
  var w: array[520, uint16]
  if path.len >= w.len:
    return writeErr(obf("path too long"), buf)
  asciiWide(path, w)
  var data: array[592, byte]
  let hFind = findFirstFileW(addr w[0], addr data[0])
  if hFind == cast[pointer](-1):
    return writeErr(obf("path not found"), buf)
  defer:
    discard findClose(hFind)
  let attrs = rdLe32(data, 0)
  let isDir = (attrs and 0x10) != 0
  let sz = (uint64(rdLe32(data, 28)) shl 32) or uint64(rdLe32(data, 32))
  var sizeHuman = obf("-")
  if not isDir:
    var sizeBuf: array[24, char]
    let sn = fmtSize(sz, sizeBuf)
    if sn > 0:
      sizeHuman = newString(sn)
      copyMem(addr sizeHuman[0], addr sizeBuf[0], sn)
    else:
      sizeHuman = $sz
  var attrLbl = ""
  if (attrs and 0x10) != 0: attrLbl.add obf("D")
  if (attrs and 0x2) != 0: attrLbl.add obf("H")
  if (attrs and 0x1) != 0: attrLbl.add obf("R")
  if (attrs and 0x4) != 0: attrLbl.add obf("S")
  if (attrs and 0x20) != 0: attrLbl.add obf("A")
  if attrLbl.len == 0: attrLbl = obf("-")
  var report = obf("path: ") & path & '\n'
  report.add obf("type: ") & (if isDir: obf("directory") else: obf("file")) & '\n'
  report.add obf("size: ") & sizeHuman & obf(" (") & $sz & obf(" bytes)\n")
  report.add obf("attributes: 0x") & toHex(attrs, 8) & ' ' & attrLbl & '\n'
  for (label, off) in [(obf("created"), 4), (obf("accessed"), 12), (obf("modified"), 20)]:
    var st: array[16, byte]
    var dateBuf: array[20, char]
    var at = obf("-")
    if not (rdLe32(data, off) == 0 and rdLe32(data, off + 4) == 0):
      if fileTimeToSystemTime(addr data[off], addr st[0]) != 0:
        let dn = fmtSystemTime(st, dateBuf)
        if dn > 0:
          at = newString(dn)
          copyMem(addr at[0], addr dateBuf[0], dn)
    report.add(label & obf(": ") & at & '\n')
  writeMsg(report, buf)
