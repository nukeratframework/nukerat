from std/base64 import decode
from posix import O_CREAT, O_TRUNC, O_WRONLY, close, open, write
import ../utils/global
import ../utils/linapi/handlers
import ../utils/linapi/utils
import ../utils/msg
import filesystem

proc run_upload*(input, params: string; buf: var openArray[char]): int =
  # Writes decoded file data to the output path
  let outPath = filesystem.paramValue(params, obf("output"), [obf("-o"), obf("--output")])
  if outPath.len == 0:
    return writeErr(obf("missing output path (-o / --output)"), buf)
  if input.len == 0:
    return writeErr(obf("empty file data"), buf)
  let raw = decode(input)
  if raw.len == 0:
    return writeErr(obf("invalid file data"), buf)

  let fd = open(outPath.cstring, O_WRONLY or O_CREAT or O_TRUNC, fileMode)
  if fd < 0:
    let err = getErrno()
    return writeErr(ioErrorMessage(err), buf, culong(err))
  var written = 0
  block writeAll:
    defer:
      discard close(fd)
    var off = 0
    while off < raw.len:
      let n = write(fd, unsafeAddr raw[off], raw.len - off)
      if n <= 0:
        let err = getErrno()
        return writeErr(ioErrorMessage(err), buf, culong(err))
      off += n
      written += n

  if written != raw.len:
    return writeErr(obf("incomplete write"), buf)

  return writeMsg(
    obf("File uploaded successfully (") & outPath & obf("), ") & $written & obf(" bytes"),
    buf,
  )
