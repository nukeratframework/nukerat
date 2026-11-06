import std/math
import ../../linapi/handlers
import ./types
import ./parse
import ./trampoline

proc sectionProt(flags: uint64): cint =
  # Builds the memory protection flags for a section
  let exec = (flags and SHF_EXECINSTR) != 0
  let write = (flags and SHF_WRITE) != 0
  if exec and write:
    memProtRead or memProtWrite or memProtExec
  elif exec:
    memProtRead or memProtExec
  elif write:
    memProtRead or memProtWrite
  else:
    memProtRead

proc mapSections*(ctx: ElfCtx): (bool, int32, string) =
  # Maps allocatable elf sections into memory
  for i, sh in ctx.sections:
    if (sh.sh_flags and SHF_ALLOC) == 0:
      continue
    let size = max(int(sh.sh_size), 1)
    ctx.secSize[i] = size
    let mem = mmap(nil, size.csize_t, memProtRead or memProtWrite, memMapPrivate or memMapAnonymous, -1, 0)
    if mapFailed(mem):
      return elfFail(1)
    if sh.sh_type != SHT_NOBITS and sh.sh_size > 0:
      var check = checkBounds(ctx.data, sh.sh_offset.int, sh.sh_size.int)
      if not check[0]:
        discard munmap(mem, size.csize_t)
        return check
      copyMem(mem, unsafeAddr ctx.data[sh.sh_offset.int], sh.sh_size.int)
    else:
      zeroMem(mem, size)
    ctx.secMem[i] = mem
  elfOk()

proc protectSections*(ctx: ElfCtx): (bool, int32, string) =
  # Applies the final protection flags on mapped sections
  for i, sh in ctx.sections:
    if ctx.secMem[i] == nil:
      continue
    let prot = sectionProt(sh.sh_flags)
    if mprotect(ctx.secMem[i], ctx.secSize[i].csize_t, prot) != 0:
      return elfFail(1)
  elfOk()

proc findEntryPoint*(ctx: ElfCtx; entryName: string): (pointer, (bool, int32, string)) =
  # Finds the entry symbol address by name
  for i, sym in ctx.symtab:
    let symName = ctx.symName(sym)
    if symName == entryName and sym.st_shndx != SHN_UNDEF:
      if i < ctx.symValues.len:
        let entryAddr = cast[pointer](ctx.symValues[i])
        return (entryAddr, elfOk())
  (nil, elfFail(1))

proc freeElfMemory*(ctx: ElfCtx) =
  # Unmaps elf sections and frees trampoline memory
  if ctx == nil:
    return
  for i, mem in ctx.secMem:
    if mem != nil and ctx.secSize[i] > 0:
      discard munmap(mem, ctx.secSize[i].csize_t)
  ctx.secMem = @[]
  ctx.secSize = @[]
  ctx.data = @[]
  freeTrampolines()
