import ./types
import ./parse
import ./symbols
import ./ptrmath

proc fitsInt32(value: int64): bool =
  # Checks that a value fits in a 32 bit integer
  value >= int32.low.int64 and value <= int32.high.int64

proc patchRel32(patchAddr: pointer; patchInt, target: int; addend: int): (bool, int32, string) =
  # Patches a 32 bit relative relocation
  var value = cast[ptr int32](patchAddr)[].int64
  value = value + (cast[int64](target) - (cast[int64](patchInt) + addend))
  if not fitsInt32(value):
    return fail(1)
  cast[ptr int32](patchAddr)[] = int32(value)
  coffOk()

proc applyRelocation*(
  ctx: seq[pointer],
  sectionIndex: int,
  relocation: pointer,
  target: pointer,
  symbol: pointer,
): (bool, int32, string) =
  # Applies one coff relocation to a section
  let sectionBase = sectionMem(ctx)[sectionIndex]
  if sectionBase == nil:
    return fail(1)

  let patchAddr = cast[pointer](cast[int](sectionBase) + int(relU32(relocation, 0)))
  let patchInt = cast[int](patchAddr)
  let relType = relU16(relocation, 8)

  case relType
  of IMAGE_REL_AMD64_ABSOLUTE:
    discard
  of IMAGE_REL_AMD64_ADDR64:
    var value = cast[ptr uint64](patchAddr)[]
    value = value + cast[uint64](cast[int](target))
    cast[ptr uint64](patchAddr)[] = value
  of IMAGE_REL_AMD64_ADDR32:
    let value = cast[int64](cast[uint64](cast[ptr uint32](patchAddr)[])) + cast[int64](cast[int](target))
    if not fitsInt32(value):
      return fail(1)
    cast[ptr uint32](patchAddr)[] = uint32(value)
  of IMAGE_REL_AMD64_ADDR32NB:
    var value = cast[ptr int32](patchAddr)[].int64
    if symbolIsDefined(symbol):
      let refIndex = int(symU16(symbol, 12)) - 1
      if refIndex < 0 or refIndex >= sectionMem(ctx).len:
        return fail(1)
      let refSection = sectionMem(ctx)[refIndex]
      if refSection == nil:
        return fail(1)
      value = cast[int64](cast[int](refSection) + value) - (cast[int64](patchInt) + 4)
      value += int64(symU32(symbol, 8))
    else:
      value = cast[int64](cast[int](target)) - (cast[int64](patchInt) + 4)
    if not fitsInt32(value):
      return fail(1)
    cast[ptr int32](patchAddr)[] = int32(value)
  of IMAGE_REL_AMD64_REL32: return patchRel32(patchAddr, patchInt, cast[int](target), 4)
  of IMAGE_REL_AMD64_REL32_1: return patchRel32(patchAddr, patchInt, cast[int](target), 5)
  of IMAGE_REL_AMD64_REL32_2: return patchRel32(patchAddr, patchInt, cast[int](target), 6)
  of IMAGE_REL_AMD64_REL32_3: return patchRel32(patchAddr, patchInt, cast[int](target), 7)
  of IMAGE_REL_AMD64_REL32_4: return patchRel32(patchAddr, patchInt, cast[int](target), 8)
  of IMAGE_REL_AMD64_REL32_5: return patchRel32(patchAddr, patchInt, cast[int](target), 9)
  else:
    return fail(1)

  coffOk()

proc processRelocations*(
  ctx: seq[pointer],
  resolveExternal: proc(name: string): pointer {.nimcall.},
): (bool, int32, string) =
  # Processes every relocation in the coff object
  let fh = ctxFileHeader(ctx)
  let nSec = int(fhU16(fh, 2))
  let data = ctxGetData(ctx)[]
  for sectionIndex in 0 ..< nSec:
    let header = cast[pointer](cast[int](ctxSectionHeaders(ctx)) + sectionIndex * SZ_SECTION_HEADER)
    let nRel = int(shU16(header, 32))
    if nRel == 0:
      continue

    let relocCheck = checkBounds(
      data,
      int(shU32(header, 24)),
      SZ_RELOC * nRel,
    )
    if not relocCheck[0]:
      return relocCheck

    let relocBase = cast[pointer](unsafeAddr data[int(shU32(header, 24))])
    for relocIndex in 0 ..< nRel:
      let relocation = cast[pointer](cast[int](relocBase) + relocIndex * SZ_RELOC)
      let symIdx = relU32(relocation, 4)
      if symIdx >= fhU32(fh, 12):
        return fail(1)

      let symbolEntry = cast[pointer](cast[int](ctxSymbolTable(ctx)) + int(symIdx) * SZ_SYMBOL)
      let symbolName = readSymbolName(ctx, symbolEntry)
      let (resolved, resolveResult) = resolveSymbolAddress(ctx, symbolEntry, symbolName, resolveExternal)
      if not resolveResult[0]:
        return resolveResult

      let target =
        if symbolIsExternal(symbolEntry) and symU32(symbolEntry, 8) == 0:
          allocImportSlot(ctx, resolved)
        else:
          resolved

      let result = applyRelocation(ctx, sectionIndex, relocation, target, symbolEntry)
      if not result[0]:
        return result

  coffOk()
