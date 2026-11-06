import std/strutils
import ./types

proc checkBounds*(data: openArray[byte]; offset: int; size: int): (bool, int32, string) =
  # Checks that an offset and size stay inside the data
  if offset < 0 or size < 0 or offset > data.len or size > data.len - offset:
    return elfFail(1)
  elfOk()

proc readHeader*(data: openArray[byte]): (Elf64Ehdr, (bool, int32, string)) =
  # Reads and checks the elf header
  if data.len < sizeof(Elf64Ehdr):
    return (default(Elf64Ehdr), elfFail(1))
  var hdr: Elf64Ehdr
  copyMem(addr hdr, unsafeAddr data[0], sizeof(Elf64Ehdr))
  if hdr.elfIdent[0] != ELFMAG0 or hdr.elfIdent[1] != ELFMAG1 or hdr.elfIdent[2] != ELFMAG2 or hdr.elfIdent[3] != ELFMAG3:
    return (hdr, elfFail(1))
  if hdr.elfIdent[4] != ELFCLASS64 or hdr.elfIdent[5] != ELFDATA2LSB:
    return (hdr, elfFail(1))
  if hdr.e_type != ET_REL or hdr.e_machine != EM_X86_64:
    return (hdr, elfFail(1))
  (hdr, elfOk())

proc readSections*(data: openArray[byte]; hdr: Elf64Ehdr): (seq[Elf64Shdr], (bool, int32, string)) =
  # Reads the elf section headers
  let shOff = hdr.e_shoff.int
  let shEnt = hdr.e_shentsize.int
  let shNum = hdr.e_shnum.int
  var check = checkBounds(data, shOff, shEnt * shNum)
  if not check[0]:
    return (@[], check)
  var sections = newSeq[Elf64Shdr](shNum)
  for i in 0 ..< shNum:
    copyMem(addr sections[i], unsafeAddr data[shOff + i * shEnt], sizeof(Elf64Shdr))
  (sections, elfOk())

proc readStringTable*(data: openArray[byte]; sh: Elf64Shdr): (string, (bool, int32, string)) =
  # Reads one elf string table
  var check = checkBounds(data, sh.sh_offset.int, sh.sh_size.int)
  if not check[0]:
    return ("", check)
  if sh.sh_size == 0:
    return ("", elfOk())
  var table = newString(sh.sh_size.int)
  copyMem(table[0].addr, unsafeAddr data[sh.sh_offset.int], sh.sh_size.int)
  (table, elfOk())

proc readSymtab*(data: openArray[byte]; sh: Elf64Shdr): (seq[Elf64Sym], (bool, int32, string)) =
  # Reads the elf symbol table
  let count = if sh.sh_entsize > 0: int(sh.sh_size div sh.sh_entsize) else: 0
  var check = checkBounds(data, sh.sh_offset.int, int(sh.sh_size))
  if not check[0]:
    return (@[], check)
  var syms = newSeq[Elf64Sym](count)
  for i in 0 ..< count:
    copyMem(addr syms[i], unsafeAddr data[sh.sh_offset.int + i * int(sh.sh_entsize)], sizeof(Elf64Sym))
  (syms, elfOk())

proc bofArgsProvided*(args: pointer; argsSize: uint32): bool =
  # Checks that packed bof arguments were provided
  if args == nil or argsSize < 4:
    return false
  let packedLen = cast[ptr uint32](args)[]
  packedLen > 0'u32

proc validateElf*(data: openArray[byte]): (ElfCtx, (bool, int32, string)) =
  # Parses an elf object and builds the loader context
  if data.len < sizeof(Elf64Ehdr):
    return (nil, elfFail(1))

  var stored = newSeq[byte](data.len)
  if data.len > 0:
    copyMem(addr stored[0], unsafeAddr data[0], data.len)

  let (hdr, hdrRes) = readHeader(stored)
  if not hdrRes[0]:
    return (nil, hdrRes)

  let (sections, secRes) = readSections(stored, hdr)
  if not secRes[0]:
    return (nil, secRes)

  var ctx = ElfCtx(data: stored, ehdr: hdr, sections: sections)
  ctx.secMem = newSeq[pointer](sections.len)
  ctx.secSize = newSeq[int](sections.len)

  if hdr.e_shstrndx < sections.len.uint16:
    let (shstr, shstrRes) = readStringTable(stored, sections[hdr.e_shstrndx.int])
    if not shstrRes[0]:
      return (nil, shstrRes)
    ctx.shstrtab = shstr

  for i, sh in sections:
    if sh.sh_type == SHT_SYMTAB:
      let (syms, symRes) = readSymtab(stored, sh)
      if not symRes[0]:
        return (nil, symRes)
      ctx.symtab = syms
      if sh.sh_link < sections.len.uint32:
        let (strtab, strRes) = readStringTable(stored, sections[sh.sh_link.int])
        if not strRes[0]:
          return (nil, strRes)
        ctx.strtab = strtab

  if ctx.symtab.len == 0:
    return (nil, elfFail(1))

  (ctx, elfOk())

proc coffRequiresBofArgs*(ctx: ElfCtx): bool =
  # Checks that the object imports beacon data helpers
  for sym in ctx.symtab:
    if sym.st_shndx == SHN_UNDEF and symBind(sym.st_info) in [STB_GLOBAL, STB_WEAK]:
      let name = ctx.symName(sym)
      if name.startsWith("BeaconData"):
        return true
  false
