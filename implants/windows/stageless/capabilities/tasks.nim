import std/[json, strutils]
import ../utils/global
import ../utils/msg
import ../utils/winapi/handlers
import ../utils/tasks/tasks as tdb
import ../utils/tasks/threads as tthr

const threadTerminate = 0x0001'u32

proc run_list*(buf: var openArray[char]): int =
  # Writes the list of alive background tasks
  let self = getCurrentThreadId()
  var text = ""
  for wid in tthr.threadOrder:
    let (ok, tr) = tthr.read_thread(wid)
    if ok and tr.alive and tr.tid != self:
      text &= obf("[ ") & $tr.taskId & obf(" ] ") & tr.name & "\n"
  writeMsg(if text.len == 0: obf("(empty)\n") else: text, buf)

proc run_kill*(params: string; buf: var openArray[char]): int =
  # Receives a task id and kills that background task
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("args")):
      return writeMsg(errorText(obf("Kill failed: missing args")), buf)
    let a = p[obf("args")]
    let s = if a.kind == JString: a.getStr().strip() else: $a.getInt()
    let taskId = parseInt(s).uint32
    let self = getCurrentThreadId()
    for wid in tthr.threadOrder:
      let (ok, tr) = tthr.read_thread(wid)
      if not ok or tr.taskId != taskId or not tr.alive:
        continue
      if tr.tid != 0 and tr.tid != self:
        let th = openThread(threadTerminate, 0, tr.tid)
        if th != nil:
          discard terminateThread(th, 1)
          discard closeHandle(th)
      discard tthr.delete_thread(wid)
      discard tdb.delete_task(taskId)
      return writeMsg(obf("Task killed."), buf)
    writeMsg(errorText(obf("Kill failed: task not running")), buf)
  except ValueError:
    writeMsg(errorText(obf("Kill failed: invalid id")), buf)
  except JsonParsingError:
    writeMsg(errorText(obf("Kill failed: bad parameters")), buf)
