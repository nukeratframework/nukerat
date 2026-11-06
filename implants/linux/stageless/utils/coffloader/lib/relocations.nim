import ./types
import ./parse
import ./trampoline

proc fitsInt32(value: int64): bool =
  # Checks that a value fits in a signed 32 bit integer
  value >= int32.low.int64 and value <= int32.high.int64

proc applyRelaPc32(patchAddr: pointer; symValue: uint64; addend: int64; symName: string = ""): (bool, int32, string) =
  # Applies a pc relative 32 bit relocation, using a trampoline when needed
  let patchInt = cast[int](patchAddr)
  var target = symValue
  var value = target.int64 + addend - patchInt.int64
  if not fitsInt32(value):
    let tramp = getOrCreateTrampoline(cast[pointer](symValue))
    if tramp == nil:
      return elfFail(1)
    target = uint64(cast[int](tramp))
    value = target.int64 + addend - patchInt.int64
    if not fitsInt32(value):
      return elfFail(1)
  cast[ptr int32](patchAddr)[] = int32(value)
  elfOk()

proc applyRela64(patchAddr: pointer; symValue: uint64; addend: int64; symName: string = ""): (bool, int32, string) =
  # Applies a 64 bit absolute relocation
  let value = uint64(symValue.int64 + addend)
  cast[ptr uint64](patchAddr)[] = value
  elfOk()

proc processRelocations*(ctx: ElfCtx): (bool, int32, string) =
  # Walks rela sections and applies each relocation
  var relaCount = 0
  for relSecIdx, sh in ctx.sections:
    if sh.sh_type != SHT_RELA:
      continue
    let targetSec = sh.sh_info.int
    let count = if sh.sh_entsize > 0: int(sh.sh_size div sh.sh_entsize) else: 0
    relaCount += count
    if targetSec < 0 or targetSec >= ctx.secMem.len:
      return elfFail(1)
    let targetBase = ctx.secMem[targetSec]
    if targetBase == nil:
      continue
    var check = checkBounds(ctx.data, sh.sh_offset.int, int(sh.sh_size))
    if not check[0]:
      return check
    for i in 0 ..< count:
      var rel: Elf64Rela
      copyMem(addr rel, unsafeAddr ctx.data[sh.sh_offset.int + i * int(sh.sh_entsize)], sizeof(Elf64Rela))
      let symIdx = relSym(rel.r_info).int
      if symIdx < 0 or symIdx >= ctx.symValues.len:
        return elfFail(1)
      let symName = if symIdx < ctx.symtab.len: ctx.symName(ctx.symtab[symIdx]) else: ""
      let relTypeVal = relType(rel.r_info)
      let symValue = ctx.symValues[symIdx]
      let patchAddr = cast[pointer](cast[int](targetBase) + rel.r_offset.int)
      case relTypeVal
      of R_X86_64_NONE:
        discard
      of R_X86_64_64:
        var res = applyRela64(patchAddr, symValue, rel.r_addend, symName)
        if not res[0]:
          return res
      of R_X86_64_PC32, R_X86_64_PLT32, R_X86_64_GOTPCREL:
        var res = applyRelaPc32(patchAddr, symValue, rel.r_addend, symName)
        if not res[0]:
          return res
      else:
        return elfFail(1)
  elfOk()
