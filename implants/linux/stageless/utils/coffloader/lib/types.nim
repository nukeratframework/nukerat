const
  ELFMAG0* = 0x7F'u8
  ELFMAG1* = 'E'.byte
  ELFMAG2* = 'L'.byte
  ELFMAG3* = 'F'.byte
  ELFCLASS64* = 2'u8
  ELFDATA2LSB* = 1'u8
  ET_REL* = 1'u16
  EM_X86_64* = 62'u16
  SHT_NULL* = 0'u32
  SHT_PROGBITS* = 1'u32
  SHT_SYMTAB* = 2'u32
  SHT_STRTAB* = 3'u32
  SHT_RELA* = 4'u32
  SHT_NOBITS* = 8'u32
  SHF_ALLOC* = 0x2'u32
  SHF_EXECINSTR* = 0x4'u32
  SHF_WRITE* = 0x1'u32
  SHN_UNDEF* = 0'u16
  STB_GLOBAL* = 1'u8
  STB_WEAK* = 2'u8
  STT_FUNC* = 2'u8
  STT_NOTYPE* = 0'u8
  R_X86_64_NONE* = 0'u64
  R_X86_64_64* = 1'u64
  R_X86_64_PC32* = 2'u64
  R_X86_64_PLT32* = 4'u64
  R_X86_64_GOTPCREL* = 9'u64

type
  Elf64Ehdr* = object
    elfIdent*: array[16, uint8]
    e_type*: uint16
    e_machine*: uint16
    e_version*: uint32
    e_entry*: uint64
    e_phoff*: uint64
    e_shoff*: uint64
    e_flags*: uint32
    e_ehsize*: uint16
    e_phentsize*: uint16
    e_phnum*: uint16
    e_shentsize*: uint16
    e_shnum*: uint16
    e_shstrndx*: uint16

  Elf64Shdr* = object
    sh_name*: uint32
    sh_type*: uint32
    sh_flags*: uint64
    sh_addr*: uint64
    sh_offset*: uint64
    sh_size*: uint64
    sh_link*: uint32
    sh_info*: uint32
    sh_addend*: uint64
    sh_entsize*: uint64
    sh_align*: uint64

  Elf64Sym* = object
    st_name*: uint32
    st_info*: uint8
    st_other*: uint8
    st_shndx*: uint16
    st_value*: uint64
    st_size*: uint64

  Elf64Rela* = object
    r_offset*: uint64
    r_info*: uint64
    r_addend*: int64

  ElfCtx* = ref object
    data*: seq[byte]
    ehdr*: Elf64Ehdr
    sections*: seq[Elf64Shdr]
    secMem*: seq[pointer]
    secSize*: seq[int]
    symtab*: seq[Elf64Sym]
    strtab*: string
    shstrtab*: string
    symValues*: seq[uint64]

proc elfOk*(): (bool, int32, string) =
  # Returns a successful elf status
  (true, 0'i32, "")
proc elfFail*(code: int32, msg: string = ""): (bool, int32, string) =
  # Returns a failed elf status
  (false, code, msg)

proc symBind*(info: uint8): uint8 =
  # Returns the bind value from a symbol info byte
  info shr 4
proc symType*(info: uint8): uint8 =
  # Returns the type value from a symbol info byte
  info and 0x0F'u8
proc relType*(info: uint64): uint64 =
  # Returns the type value from relocation info
  info and 0xFFFFFFFF'u64
proc relSym*(info: uint64): uint32 =
  # Returns the symbol index from relocation info
  uint32(info shr 32)

proc symName*(ctx: ElfCtx; sym: Elf64Sym): string =
  # Reads a symbol name from the string table
  if sym.st_name.int >= ctx.strtab.len:
    return ""
  let start = sym.st_name.int
  var nameEnd = start
  while nameEnd < ctx.strtab.len and ctx.strtab[nameEnd] != '\0':
    inc nameEnd
  ctx.strtab[start ..< nameEnd]

proc secName*(ctx: ElfCtx; index: int): string =
  # Reads a section name from the section string table
  if index < 0 or index >= ctx.sections.len:
    return ""
  let sh = ctx.sections[index]
  if sh.sh_name.int >= ctx.shstrtab.len:
    return ""
  let start = sh.sh_name.int
  var nameEnd = start
  while nameEnd < ctx.shstrtab.len and ctx.shstrtab[nameEnd] != '\0':
    inc nameEnd
  ctx.shstrtab[start ..< nameEnd]
