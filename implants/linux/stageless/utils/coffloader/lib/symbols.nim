import ../../global
import ./types

proc dlopen(name: cstring, flags: cint): pointer {.importc, header: "<dlfcn.h>".}
proc dlsym(handle: pointer, name: cstring): pointer {.importc, header: "<dlfcn.h>".}

let BareImportLibs = [
  obf("libc.so.6"),
  obf("libm.so.6"),
  obf("libpthread.so.0"),
  obf("libdl.so.2"),
]

proc resolveFromLib(library, funcName: cstring): pointer =
  # Loads a library and returns the address of a named symbol
  let handle = dlopen(library, 0x00001)
  if handle == nil:
    return nil
  dlsym(handle, funcName)

proc defaultResolveExternal*(name: string): pointer =
  # Resolves an external symbol from the process or common libraries
  if name.len == 0:
    return nil
  let sym = name.cstring
  result = dlsym(nil, sym)
  if result != nil:
    return result
  for lib in BareImportLibs:
    result = resolveFromLib(cstring(lib), sym)
    if result != nil:
      return result
  return nil

proc resolveSymbolValues*(
  ctx: ElfCtx,
  resolveExternal: proc(name: string): pointer {.nimcall.},
): (bool, int32, string) =
  # Resolves each symbol address and stores it on the elf context
  ctx.symValues = newSeq[uint64](ctx.symtab.len)
  for i, sym in ctx.symtab:
    let name = ctx.symName(sym)
    if sym.st_shndx == SHN_UNDEF:
      if symBind(sym.st_info) in [STB_GLOBAL, STB_WEAK]:
        if name.len == 0:
          continue
        let symAddr = resolveExternal(name)
        if symAddr == nil:
          return elfFail(1, obf("Unresolved symbol: ") & name)
        ctx.symValues[i] = uint64(cast[int](symAddr))
      continue
    if sym.st_shndx < ctx.sections.len.uint16:
      let secIdx = sym.st_shndx.int
      if ctx.secMem[secIdx] == nil:
        continue
      ctx.symValues[i] = uint64(cast[int](ctx.secMem[secIdx]) + sym.st_value.int)
  elfOk()
