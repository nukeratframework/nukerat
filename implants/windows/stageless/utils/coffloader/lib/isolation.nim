import ../../global
import ../../winapi/handlers
import ../../winapi/syscall
import ../../winapi/utils
import ./types
import ./beacon

var tlsBofActive {.threadvar.}: int

proc bofIsolationVeh(ep: ptr EXCEPTION_POINTERS): culong {.stdcall.} =
  # Handles a bof exception by exiting the thread
  if tlsBofActive != 0:
    tlsBofActive = 0
    exitThread(ep.ExceptionRecord.ExceptionCode)
  EXCEPTION_CONTINUE_SEARCH

proc bofThreadProc(param: pointer): culong {.stdcall.} =
  # Runs the coff entry on an isolated thread
  let entry = cast[proc(args: pointer, argsSize: uint32) {.cdecl.}](cast[ptr pointer](param)[])
  let args = cast[ptr pointer](cast[int](param) + sizeof(pointer))[]
  let argsSize = cast[ptr uint32](cast[int](param) + 2 * sizeof(pointer))[]
  var stackGuarantee: culong = 64 * 1024
  discard setThreadStackGuarantee(addr stackGuarantee)
  let veh = addVectoredExceptionHandler(1, cast[pointer](cast[pointer](bofIsolationVeh)))
  tlsBofActive = 1
  entry(args, argsSize)
  tlsBofActive = 0
  discard removeVectoredExceptionHandler(veh)
  0

proc runCoffEntryIsolated*(entry: pointer, args: pointer, argsSize: uint32): int32 =
  # Runs the coff entry inside a worker thread
  var runArgs: array[24, byte]
  cast[ptr pointer](addr runArgs[0])[] = entry
  cast[ptr pointer](addr runArgs[8])[] = args
  cast[ptr uint32](addr runArgs[16])[] = argsSize
  inc bgWorkers
  let hThread = createThread(cast[pointer](cast[pointer](bofThreadProc)), addr runArgs[0])
  if hThread == nil:
    dec bgWorkers
    return 1
  defer: dec bgWorkers
  discard waitForObject(hThread)
  var threadExit: culong = 0
  discard getExitCodeThread(hThread, addr threadExit)
  discard ntCloseHandle(hThread)

  if threadExit != 0:
    int32(threadExit)
  else:
    0
