import ../../global
import ../../linapi/handlers
import ./symbols

{.emit: """
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct { char* original; char* buffer; int length; int size; } BOF_DATAP;
N_LIB_PRIVATE N_CDECL(void, bofAppendCString)(NCSTRING text, int size);

static void bofFormatVprintf(const char *fmt, va_list ap) {
  char buf[8192];
  va_list copy;
  if (!fmt) return;
  va_copy(copy, ap);
  int n = vsnprintf(buf, sizeof(buf), fmt, copy);
  va_end(copy);
  if (n <= 0) return;
  if (n >= (int)sizeof(buf)) n = (int)sizeof(buf) - 1;
  bofAppendCString((NCSTRING)buf, n);
}

N_CDECL(void, BeaconPrintf)(int btype, char *fmt, ...) {
  (void)btype;
  if (!fmt) return;
  va_list ap;
  va_start(ap, fmt);
  bofFormatVprintf(fmt, ap);
  va_end(ap);
}
""".}

proc getBeaconPrintfAddr*(): pointer =
  # Returns the address of the beacon printf helper
  {.emit: "result = (void*)&BeaconPrintf;".}

var bofOutputBuffer*: seq[byte]

proc resetBofOutput*() =
  # Clears the bof output buffer
  bofOutputBuffer.setLen(0)

proc bofGetOutputData*(): seq[byte] =
  # Returns the bof output and clears the buffer
  result = bofOutputBuffer
  bofOutputBuffer = @[]

proc appendRawOutput*(data: pointer; size: int) =
  # Appends raw bytes to the bof output buffer
  if data == nil or size <= 0:
    return
  let start = bofOutputBuffer.len
  bofOutputBuffer.setLen(start + size)
  copyMem(addr bofOutputBuffer[start], data, size)

proc bofAppendCString*(text: cstring; size: cint) {.cdecl, exportc: "bofAppendCString".} =
  # Appends a c string to the bof output buffer
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
  # Initializes a beacon data parser over the buffer
  if parser == nil or buffer == nil:
    return
  dpOriginal(parser) = buffer
  dpBuffer(parser) = buffer
  dpLength(parser) = size - 4
  dpSize(parser) = size - 4
  dpBuffer(parser) = cast[cstring](cast[int](buffer) + 4)

proc BeaconDataInt*(parser: pointer): cint {.cdecl.} =
  # Reads the next 32 bit integer from the parser
  if parser == nil or dpLength(parser) < 4:
    return 0
  var value: int32
  copyMem(addr value, dpBuffer(parser), sizeof(int32))
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + 4)
  dpLength(parser) -= 4
  int32(value)

proc BeaconDataShort*(parser: pointer): int16 {.cdecl.} =
  # Reads the next 16 bit integer from the parser
  if parser == nil or dpLength(parser) < 2:
    return 0
  var value: int16
  copyMem(addr value, dpBuffer(parser), sizeof(int16))
  dpBuffer(parser) = cast[cstring](cast[int](dpBuffer(parser)) + 2)
  dpLength(parser) -= 2
  value

proc BeaconDataLength*(parser: pointer): cint {.cdecl.} =
  # Returns how many bytes remain in the parser
  if parser == nil: 0 else: dpLength(parser)

proc BeaconDataExtract*(parser: pointer; size: ptr cint): cstring {.cdecl.} =
  # Extracts the next sized blob from the parser
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

proc BeaconOutput*(btype: cint; data: cstring; len: cint) {.cdecl.} =
  # Appends beacon output bytes to the buffer
  discard btype
  appendRawOutput(data, len.int)

proc resolveInternalApi(funcName: string): pointer =
  # Finds the address of a built in beacon api
  if funcName == obf("BeaconDataParse"): 
    return cast[pointer](BeaconDataParse)
  if funcName == obf("BeaconDataInt"): 
    return cast[pointer](BeaconDataInt)
  if funcName == obf("BeaconDataShort"): 
    return cast[pointer](BeaconDataShort)
  if funcName == obf("BeaconDataLength"): 
    return cast[pointer](BeaconDataLength)
  if funcName == obf("BeaconDataExtract"): 
    return cast[pointer](BeaconDataExtract)
  if funcName == obf("BeaconPrintf"): 
    return getBeaconPrintfAddr()
  if funcName == obf("BeaconOutput"): 
    return cast[pointer](BeaconOutput)
  nil

proc resolveBofExternal*(symbol: string): pointer =
  # Resolves a bof symbol from internal apis or the default resolver
  let internal = resolveInternalApi(symbol)
  if internal != nil:
    return internal
  let ext = defaultResolveExternal(symbol)
  ext
