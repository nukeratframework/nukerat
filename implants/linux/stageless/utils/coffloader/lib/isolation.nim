import ../../global
import ../../linapi/handlers
import ./types

type
  BofThreadParam = object
    entry: pointer
    args: pointer
    argsSize: uint32

proc bofThreadProc(param: pointer): pointer {.noconv.} =
  # Runs the coff entry on a worker thread
  let p = cast[ptr BofThreadParam](param)
  let entry = cast[proc(args: pointer; argsSize: cint) {.cdecl.}](p.entry)
  entry(p.args, cint(p.argsSize))
  nil

proc runCoffEntryIsolated*(entry: pointer; args: pointer; argsSize: uint32): int32 =
  # Starts the coff entry on its own thread and waits for it
  var runArgs = BofThreadParam(entry: entry, args: args, argsSize: argsSize)
  inc bgWorkers
  var tid: Pthread
  if not spawnPthread(tid, bofThreadProc, addr runArgs):
    dec bgWorkers
    return 1
  joinPthread(tid)
  dec bgWorkers
  0
