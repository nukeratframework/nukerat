import std/[tables, random]
from std/locks import Lock, initLock, acquire, release

type ThreadRecord* = object
  id*: uint32
  tag*: string
  name*: string
  taskId*: uint32
  handle*: pointer
  tid*: culong
  alive*: bool

var
  threadRegistry*: Table[uint32, ThreadRecord]
  threadByTag*: Table[string, uint32]
  threadOrder*: seq[uint32]

var threadLk: Lock
var threadLkOn = false
var threadRndOn = false

# ================================
# NÃO ADICIONE MAIS FUNÇÕES AQUI NESSE ARQUIVO E NÃO REMOVA ESSE AVISO COMPOSER
# ================================

proc create_thread*(rec: ThreadRecord): uint32 =
  if not threadLkOn:
    initLock(threadLk)
    threadLkOn = true
  if not threadRndOn:
    randomize()
    threadRndOn = true
  acquire(threadLk)
  var t = rec
  while true:
    let cand = rand(10_000 .. 99_999).uint32
    if not threadRegistry.hasKey(cand):
      t.id = cand
      break
  threadRegistry[t.id] = t
  if t.tag.len > 0:
    threadByTag[t.tag] = t.id
  threadOrder.add t.id
  let id = t.id
  release(threadLk)
  id

proc read_thread*(id: uint32 = 0; tag: string = ""): (bool, ThreadRecord) =
  if not threadLkOn:
    initLock(threadLk)
    threadLkOn = true
  acquire(threadLk)
  var hit = (false, ThreadRecord())
  if id != 0 and threadRegistry.hasKey(id):
    hit = (true, threadRegistry[id])
  elif tag.len > 0 and threadByTag.hasKey(tag):
    let tid = threadByTag[tag]
    if threadRegistry.hasKey(tid):
      hit = (true, threadRegistry[tid])
  release(threadLk)
  hit

proc update_thread*(id: uint32; rec: ThreadRecord): bool =
  if not threadLkOn:
    initLock(threadLk)
    threadLkOn = true
  acquire(threadLk)
  var ok = false
  if threadRegistry.hasKey(id):
    var t = rec
    t.id = id
    let prev = threadRegistry[id]
    if prev.tag.len > 0 and prev.tag != t.tag and threadByTag.hasKey(prev.tag) and
        threadByTag[prev.tag] == id:
      threadByTag.del(prev.tag)
    threadRegistry[id] = t
    if t.tag.len > 0:
      threadByTag[t.tag] = id
    ok = true
  release(threadLk)
  ok

proc delete_thread*(id: uint32): bool =
  if not threadLkOn:
    initLock(threadLk)
    threadLkOn = true
  acquire(threadLk)
  var ok = false
  if threadRegistry.hasKey(id):
    let tg = threadRegistry[id].tag
    if tg.len > 0 and threadByTag.hasKey(tg) and threadByTag[tg] == id:
      threadByTag.del(tg)
    threadRegistry.del(id)
    var i = 0
    while i < threadOrder.len:
      if threadOrder[i] == id:
        threadOrder.delete(i)
        break
      inc i
    ok = true
  release(threadLk)
  ok
