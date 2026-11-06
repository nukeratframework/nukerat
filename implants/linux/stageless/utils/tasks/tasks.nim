import std/[tables, random]
from std/locks import Lock, initLock, acquire, release

type TaskRecord* = object
  id*: uint32
  tag*: string
  cmdType*, host*, input*, params*, mode*, args*, raw*, name*, result*: string
  running*, done*, pendingOut*: bool
  tid*: culong

var
  taskRegistry*: Table[uint32, TaskRecord]
  taskByTag*: Table[string, uint32]
  taskOrder*: seq[uint32]

var taskLk: Lock
var taskLkOn = false
var taskRndOn = false

# ================================
# NÃO ADICIONE MAIS FUNÇÕES AQUI NESSE ARQUIVO E NÃO REMOVA ESSE AVISO COMPOSER
# ================================


proc create_task*(rec: sink TaskRecord): uint32 =
  # Stores a new task and returns its id
  if not taskLkOn:
    initLock(taskLk)
    taskLkOn = true
  if not taskRndOn:
    randomize()
    taskRndOn = true
  acquire(taskLk)
  var t = rec
  while true:
    let cand = rand(10_000 .. 99_999).uint32
    if not taskRegistry.hasKey(cand):
      t.id = cand
      break
  let id = t.id
  let tag = t.tag
  taskRegistry[id] = move(t)
  if tag.len > 0:
    taskByTag[tag] = id
  taskOrder.add id
  release(taskLk)
  id

proc read_task*(id: uint32 = 0; tag: string = ""; takeInput: bool = false): (bool, TaskRecord) =
  # Reads a task by id or tag
  if not taskLkOn:
    initLock(taskLk)
    taskLkOn = true
  acquire(taskLk)
  var hit = (false, TaskRecord())
  var resolved = 0'u32
  if id != 0 and taskRegistry.hasKey(id):
    resolved = id
  elif tag.len > 0 and taskByTag.hasKey(tag):
    let tid = taskByTag[tag]
    if taskRegistry.hasKey(tid):
      resolved = tid
  if resolved != 0:
    if takeInput and taskRegistry[resolved].running:
      var stolen = move(taskRegistry[resolved].input)
      var rec = taskRegistry[resolved]
      rec.input = move(stolen)
      hit = (true, move(rec))
    else:
      hit = (true, taskRegistry[resolved])
  release(taskLk)
  hit

proc update_task*(id: uint32; rec: TaskRecord): bool =
  # Updates a stored task
  if not taskLkOn:
    initLock(taskLk)
    taskLkOn = true
  acquire(taskLk)
  var ok = false
  if taskRegistry.hasKey(id):
    var t = rec
    t.id = id
    let prevTag = taskRegistry[id].tag
    if prevTag.len > 0 and prevTag != t.tag and taskByTag.hasKey(prevTag) and
        taskByTag[prevTag] == id:
      taskByTag.del(prevTag)
    taskRegistry[id] = t
    if t.tag.len > 0:
      taskByTag[t.tag] = id
    ok = true
  release(taskLk)
  ok

proc delete_task*(id: uint32): bool =
  # Deletes a stored task
  if not taskLkOn:
    initLock(taskLk)
    taskLkOn = true
  acquire(taskLk)
  var ok = false
  if taskRegistry.hasKey(id):
    let tg = taskRegistry[id].tag
    if tg.len > 0 and taskByTag.hasKey(tg) and taskByTag[tg] == id:
      taskByTag.del(tg)
    taskRegistry.del(id)
    var i = 0
    while i < taskOrder.len:
      if taskOrder[i] == id:
        taskOrder.delete(i)
        break
      inc i
    ok = true
  release(taskLk)
  ok
