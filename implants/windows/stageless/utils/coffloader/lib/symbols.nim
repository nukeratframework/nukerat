import std/strutils
import ../../global
import ../../winapi/handlers
import ./types
import ./parse

let BareImportModules = [
  obf("kernel32.dll"), obf("kernelbase.dll"), obf("ntdll.dll"), obf("advapi32.dll"),
  obf("user32.dll"), obf("gdi32.dll"), obf("ws2_32.dll"), obf("ole32.dll"), obf("shell32.dll"),
  obf("msvcrt.dll"), obf("ucrtbase.dll"), obf("crypt32.dll"), obf("netapi32.dll"),
  obf("secur32.dll"), obf("version.dll"), obf("wininet.dll"), obf("iphlpapi.dll"),
  obf("dnsapi.dll"), obf("ntmarta.dll"), obf("wtsapi32.dll"), obf("psapi.dll"),
]

proc stripCallDecoration(name: string): string =
  # Strips the stdcall decoration from the symbol name
  let at = name.find('@')
  if at >= 0: name[0 ..< at] else: name

proc normalizeLibraryName(library: string): string =
  # Normalizes the library name and appends the dll suffix
  if library.len == 0:
    return ""
  var name = library
  let dllSuffix = obf(".dll")
  if name.len > dllSuffix.len and name.toLowerAscii().endsWith(dllSuffix):
    name = name[0 ..^ (dllSuffix.len + 1)]
  case name.toUpperAscii()
  of obf("MSVCRT"): name = obf("msvcrt")
  of obf("UCRTBASE"), obf("UCRT"): name = obf("ucrtbase")
  else: name = name.toLowerAscii()
  name & dllSuffix

proc parseImportSymbol*(symbol: string): (string, string) =
  # Parses an import symbol into library and function names
  let body =
    if symbol.startsWith(ImpPrefix): symbol[ImpPrefix.len .. ^1]
    elif symbol.startsWith(PointerImpPrefix): symbol[PointerImpPrefix.len .. ^1]
    elif symbol.contains('$'): symbol
    else: return ("", "")
  let parts = body.split('$')
  if parts.len < 2:
    return ("", stripCallDecoration(body))
  (parts[0], stripCallDecoration(parts[1]))

proc symbolLooksLikeBofArgApi(symbolName: string): bool =
  # Checks that the symbol looks like a bof argument api
  let (_, funcName) = parseImportSymbol(symbolName)
  let apiName = if funcName.len > 0: funcName else: symbolName
  apiName.startsWith(obf("BeaconData"))

proc coffRequiresBofArgs*(ctx: seq[pointer]): bool =
  # Checks that the coff object imports a bof argument api
  let fh = ctxFileHeader(ctx)
  let nSym = int(fhU32(fh, 12))
  var symbolIndex = 0
  while symbolIndex < nSym:
    let entry = cast[pointer](cast[int](ctxSymbolTable(ctx)) + symbolIndex * SZ_SYMBOL)
    if symbolIsExternal(entry):
      let symbolName = readSymbolName(ctx, entry)
      if symbolLooksLikeBofArgApi(symbolName):
        return true
    symbolIndex += 1 + int(symU8(entry, 17))
  false

proc resolveFromModule(moduleName, funcName: string): pointer =
  # Resolves a function address from the named module
  let handle = loadLibraryA(moduleName)
  if handle == nil:
    return nil
  getProcAddress(handle, funcName)

proc defaultResolveExternal*(name: string): pointer =
  # Resolves an external symbol from the known modules
  let (library, funcName) = parseImportSymbol(name)
  if funcName.len == 0:
    return nil
  if library.len > 0:
    return resolveFromModule(normalizeLibraryName(library), funcName)
  for moduleName in BareImportModules:
    let resolved = resolveFromModule(moduleName, funcName)
    if resolved != nil:
      return resolved
  nil

proc resolveSymbolAddress*(
  ctx: seq[pointer],
  entry: pointer,
  symbolName: string,
  resolveExternal: proc(name: string): pointer {.nimcall.},
): (pointer, (bool, int32, string)) =
  # Resolves the address of a coff symbol
  if symbolIsDefined(entry):
    let sectionIndex = int(symU16(entry, 12)) - 1
    if sectionIndex < 0 or sectionIndex >= sectionMem(ctx).len:
      return (nil, fail(1))
    let base = sectionMem(ctx)[sectionIndex]
    if base == nil:
      return (nil, fail(1))
    return (cast[pointer](cast[int](base) + int(symU32(entry, 8))), coffOk())

  if symbolIsExternal(entry) and symU32(entry, 8) == 0:
    let resolvedAddr = resolveExternal(symbolName)
    if resolvedAddr == nil:
      return (nil, fail(1))
    return (resolvedAddr, coffOk())

  (nil, fail(1))

proc allocImportSlot*(ctx: seq[pointer], address: pointer): pointer =
  # Allocates an import slot and stores the address
  let slotIndex = importSlots(ctx)
  let slot = cast[pointer](cast[int](importTable(ctx)) + slotIndex * sizeof(pointer).int)
  cast[ptr pointer](slot)[] = address
  inc importSlots(ctx)
  slot
