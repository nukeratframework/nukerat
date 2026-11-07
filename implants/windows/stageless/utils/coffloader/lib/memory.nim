import ../../winapi/syscall
import ../../winapi/utils
import ./types
import ./parse

proc sectionAllocSize(header: pointer): int =
  # Returns the allocation size of a section
  max(int(shU32(header, 8)), int(shU32(header, 16)))

proc sectionProtection(characteristics: uint32): culong =
  # Maps section flags to a page protection value
  const mask = IMAGE_SCN_MEM_EXECUTE or IMAGE_SCN_MEM_READ or IMAGE_SCN_MEM_WRITE
  let bitMask = characteristics and mask
  if bitMask == 0:
    PAGE_NOACCESS
  elif bitMask == IMAGE_SCN_MEM_EXECUTE:
    PAGE_EXECUTE
  elif bitMask == IMAGE_SCN_MEM_READ:
    PAGE_READONLY
  elif bitMask == (IMAGE_SCN_MEM_READ or IMAGE_SCN_MEM_EXECUTE):
    PAGE_EXECUTE_READ
  elif bitMask == IMAGE_SCN_MEM_WRITE:
    PAGE_WRITECOPY
  elif bitMask == (IMAGE_SCN_MEM_EXECUTE or IMAGE_SCN_MEM_WRITE):
    PAGE_EXECUTE_WRITECOPY
  elif bitMask == (IMAGE_SCN_MEM_READ or IMAGE_SCN_MEM_WRITE):
    PAGE_READWRITE
  elif bitMask == mask:
    PAGE_EXECUTE_READWRITE
  else:
    PAGE_EXECUTE_READWRITE

proc mapSections*(ctx: seq[pointer]): (bool, int32, string) =
  # Allocates memory and copies each coff section
  let fh = ctxFileHeader(ctx)
  let nSec = int(fhU16(fh, 2))
  sectionMem(ctx).setLen(nSec)
  for sectionIndex in 0 ..< nSec:
    let header = cast[pointer](cast[int](ctxSectionHeaders(ctx)) + sectionIndex * SZ_SECTION_HEADER)
    let allocSize = sectionAllocSize(header)
    if allocSize <= 0:
      continue

    let mem = virtualAlloc(nil, csize_t(allocSize), MEM_COMMIT or MEM_RESERVE or MEM_TOP_DOWN, PAGE_READWRITE)
    if mem == nil:
      return fail(1)

    let rawSize = int(shU32(header, 16))
    if rawSize > 0:
      let data = ctxGetData(ctx)[]
      let rawCheck = checkBounds(data, int(shU32(header, 20)), rawSize)
      if not rawCheck[0]:
        discard virtualFree(mem, MEM_RELEASE)
        return rawCheck
      copyMem(mem, unsafeAddr data[int(shU32(header, 20))], rawSize)
    else:
      zeroMem(mem, allocSize)

    sectionMem(ctx)[sectionIndex] = mem
  coffOk()

proc protectImportTable*(ctx: seq[pointer]): (bool, int32, string) =
  # Marks the import table pages as read only
  let tab = importTable(ctx)
  if tab == nil:
    return coffOk()
  let slotCount = importSlots(ctx)
  if slotCount <= 0:
    return coffOk()
  let bytes = slotCount * sizeof(pointer)
  if bytes <= 0:
    return coffOk()
  var oldProt: culong = 0
  if virtualProtect(tab, culong(bytes), PAGE_READONLY, oldProt) == 0:
    return fail(1)
  coffOk()

proc protectSections*(ctx: seq[pointer]): (bool, int32, string) =
  # Applies the final page protection to each section
  let fh = ctxFileHeader(ctx)
  let nSec = int(fhU16(fh, 2))
  for sectionIndex in 0 ..< nSec:
    let header = cast[pointer](cast[int](ctxSectionHeaders(ctx)) + sectionIndex * SZ_SECTION_HEADER)
    let mem = sectionMem(ctx)[sectionIndex]
    if mem == nil:
      continue
    var oldProt: culong = 0
    let prot = sectionProtection(shU32(header, 36))
    let sz = culong(sectionAllocSize(header))
    if virtualProtect(mem, sz, prot, oldProt) == 0:
      return fail(1)
  coffOk()

proc allocImportTable*(ctx: seq[pointer], slotCount: int): (bool, int32, string) =
  # Allocates the import slot table
  if slotCount <= 0:
    importTable(ctx) = nil
    return coffOk()
  let bytes = slotCount * sizeof(pointer).int
  importTable(ctx) = virtualAlloc(nil, csize_t(bytes), MEM_COMMIT or MEM_RESERVE or MEM_TOP_DOWN, PAGE_READWRITE)
  if importTable(ctx) == nil:
    return fail(1)
  coffOk()

proc countRelocations*(ctx: seq[pointer]): int =
  # Counts the relocations across every section
  let fh = ctxFileHeader(ctx)
  let nSec = int(fhU16(fh, 2))
  for sectionIndex in 0 ..< nSec:
    let header = cast[pointer](cast[int](ctxSectionHeaders(ctx)) + sectionIndex * SZ_SECTION_HEADER)
    result += int(shU16(header, 32))

proc releaseCtxStorage(ctx: seq[pointer]) =
  # Releases the memory held by the coff context
  if ctx.len < CTX_SIZE:
    return
  if ctx[CTX_SECMEM] != nil:
    for sectionIndex, mem in sectionMem(ctx):
      if mem != nil:
        discard virtualFree(mem, MEM_RELEASE)
    cast[ptr seq[pointer]](ctx[CTX_SECMEM])[] = @[]
    deallocShared(ctx[CTX_SECMEM])
  if ctx[CTX_IMPTAB] != nil:
    if importTable(ctx) != nil:
      discard virtualFree(importTable(ctx), MEM_RELEASE)
    deallocShared(ctx[CTX_IMPTAB])
  if ctx[CTX_DATA] != nil:
    let dataPtr = cast[ptr seq[byte]](ctx[CTX_DATA])
    dataPtr[] = @[]
    deallocShared(ctx[CTX_DATA])
  if ctx[CTX_STRSZ] != nil:
    deallocShared(ctx[CTX_STRSZ])
  if ctx[CTX_IMPSLOTS] != nil:
    deallocShared(ctx[CTX_IMPSLOTS])

proc freeCoffMemory*(ctx: seq[pointer]) =
  # Frees the coff memory held by the context
  releaseCtxStorage(ctx)

proc findEntryPoint*(ctx: seq[pointer], entryName: string): (pointer, (bool, int32, string)) =
  # Finds the named entry point in the coff object
  let fh = ctxFileHeader(ctx)
  let nSym = int(fhU32(fh, 12))
  var symbolIndex = 0
  while symbolIndex < nSym:
    let entry = cast[pointer](cast[int](ctxSymbolTable(ctx)) + symbolIndex * SZ_SYMBOL)
    if readSymbolName(ctx, entry) == entryName and symbolIsDefined(entry):
      let sectionIndex = int(symU16(entry, 12)) - 1
      if sectionIndex < 0 or sectionIndex >= sectionMem(ctx).len:
        return (nil, fail(1))
      let base = sectionMem(ctx)[sectionIndex]
      if base == nil:
        return (nil, fail(1))
      let entryAddr = cast[pointer](cast[int](base) + int(symU32(entry, 8)))
      return (entryAddr, coffOk())
    symbolIndex += 1 + int(symU8(entry, 17))
  (nil, fail(1))
