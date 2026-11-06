import std/[json, strutils]
import ../utils/global
import ../utils/msg
import ../utils/linapi/handlers
import ../utils/tasks/tasks as tdb
import ../utils/tasks/threads as tthr

proc run_list*(buf: var openArray[char]): int =
  # Lists running background tasks into the output buffer
  let self = currentPthread()
  var text = ""
  for wid in tthr.threadOrder:
    let (ok, tr) = tthr.read_thread(wid)
    if ok and tr.alive and cast[Pthread](tr.handle) != self:
      text &= obf("[ ") & $tr.taskId & obf(" ] ") & tr.name & "\n"
  writeMsg(if text.len == 0: obf("(empty)\n") else: text, buf)

proc run_kill*(params: string; buf: var openArray[char]): int =
  # Finds the running task by id and kills it
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("args")):
      return writeMsg(errorText(obf("Kill failed: missing args")), buf)
    let a = p[obf("args")]
    let s = if a.kind == JString: a.getStr().strip() else: $a.getInt()
    let taskId = parseInt(s).uint32
    let self = currentPthread()
    for wid in tthr.threadOrder:
      let (ok, tr) = tthr.read_thread(wid)
      if not ok or tr.taskId != taskId or not tr.alive:
        continue
      if tr.handle != nil and cast[Pthread](tr.handle) != self:
        cancelPthread(cast[Pthread](tr.handle))
      discard tthr.delete_thread(wid)
      discard tdb.delete_task(taskId)
      return writeMsg(obf("Task killed."), buf)
    return writeMsg(errorText(obf("Kill failed: task not running")), buf)
  except ValueError:
    return writeMsg(errorText(obf("Kill failed: invalid id")), buf)
  except JsonParsingError:
    return writeMsg(errorText(obf("Kill failed: bad parameters")), buf)
