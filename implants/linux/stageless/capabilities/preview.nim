import std/json
import std/parseutils
import std/strutils
from posix import O_RDONLY, open, close, read
import ../utils/global
import ../utils/linapi/handlers
import ../utils/msg

proc run_preview*(args, params: string; buf: var openArray[char]): int =
  # Reads a limited prefix of a file into the buffer
  let path = args.strip()
  if path.len == 0:
    return writeErr(obf("missing path"), buf)
  var limit = 4096
  try:
    let p = parseJson(params)
    if p.hasKey(obf("size_limit")):
      var n = 0
      if parseInt(p[obf("size_limit")].getStr(), n) > 0 and n > 0:
        limit = n
  except JsonParsingError:
    discard
  if limit > buf.len:
    limit = buf.len
  let fd = open(path.cstring, O_RDONLY)
  if fd < 0:
    return writeErr(obf("cannot open file"), buf)
  defer:
    discard close(fd)
  var total = 0
  while total < limit:
    let chunk = min(limit - total, buf.len - total)
    if chunk <= 0:
      break
    let n = read(fd, addr buf[total], chunk)
    if n <= 0:
      break
    total += n
  total
