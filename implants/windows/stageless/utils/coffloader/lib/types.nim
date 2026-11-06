import ../../global

const
  IMAGE_FILE_MACHINE_AMD64* = 0x8664'u16
  IMAGE_SYM_CLASS_EXTERNAL* = 2'u8
  IMAGE_SYM_CLASS_EXTERNAL_DEF* = 5'u8
  IMAGE_REL_AMD64_ABSOLUTE* = 0'u16
  IMAGE_REL_AMD64_ADDR64* = 1'u16
  IMAGE_REL_AMD64_ADDR32* = 2'u16
  IMAGE_REL_AMD64_ADDR32NB* = 3'u16
  IMAGE_REL_AMD64_REL32* = 4'u16
  IMAGE_REL_AMD64_REL32_1* = 5'u16
  IMAGE_REL_AMD64_REL32_2* = 6'u16
  IMAGE_REL_AMD64_REL32_3* = 7'u16
  IMAGE_REL_AMD64_REL32_4* = 8'u16
  IMAGE_REL_AMD64_REL32_5* = 9'u16
  IMAGE_SCN_MEM_EXECUTE* = 0x20000000'u32
  IMAGE_SCN_MEM_READ* = 0x40000000'u32
  IMAGE_SCN_MEM_WRITE* = 0x80000000'u32
  SZ_FILE_HEADER* = 20
  SZ_SECTION_HEADER* = 40
  SZ_SYMBOL* = 18
  SZ_RELOC* = 10

let
  ImpPrefix* = obf("__imp_")
  PointerImpPrefix* = obf("p_")

const
  CTX_DATA* = 0
  CTX_FH* = 1
  CTX_SH* = 2
  CTX_SYM* = 3
  CTX_STR* = 4
  CTX_STRSZ* = 5
  CTX_SECMEM* = 6
  CTX_IMPTAB* = 7
  CTX_IMPSLOTS* = 8
  CTX_SIZE* = 9

proc fhU16*(p: pointer, off: int): uint16 =
  # Reads a 16 bit field from the file header
  cast[ptr uint16](cast[int](p) + off)[]

proc fhU32*(p: pointer, off: int): uint32 =
  # Reads a 32 bit field from the file header
  cast[ptr uint32](cast[int](p) + off)[]

proc shU32*(p: pointer, off: int): uint32 =
  # Reads a 32 bit field from a section header
  cast[ptr uint32](cast[int](p) + off)[]

proc shU16*(p: pointer, off: int): uint16 =
  # Reads a 16 bit field from a section header
  cast[ptr uint16](cast[int](p) + off)[]

proc symU32*(p: pointer, off: int): uint32 =
  # Reads a 32 bit field from a symbol entry
  cast[ptr uint32](cast[int](p) + off)[]

proc symU16*(p: pointer, off: int): uint16 =
  # Reads a 16 bit field from a symbol entry
  cast[ptr uint16](cast[int](p) + off)[]

proc symU8*(p: pointer, off: int): uint8 =
  # Reads an 8 bit field from a symbol entry
  cast[ptr uint8](cast[int](p) + off)[]

proc relU32*(p: pointer, off: int): uint32 =
  # Reads a 32 bit field from a relocation entry
  cast[ptr uint32](cast[int](p) + off)[]

proc relU16*(p: pointer, off: int): uint16 =
  # Reads a 16 bit field from a relocation entry
  cast[ptr uint16](cast[int](p) + off)[]

proc ctxGetData*(ctx: seq[pointer]): ptr seq[byte] =
  # Returns the stored coff bytes from the context
  cast[ptr seq[byte]](ctx[CTX_DATA])

template sectionMem*(ctx: seq[pointer]): untyped =
  # Returns the section memory sequence from the context
  cast[ptr seq[pointer]](ctx[CTX_SECMEM])[]

template importTable*(ctx: seq[pointer]): untyped =
  # Returns the import table pointer from the context
  cast[ptr pointer](ctx[CTX_IMPTAB])[]

template importSlots*(ctx: seq[pointer]): untyped =
  # Returns the import slot count from the context
  cast[ptr int](ctx[CTX_IMPSLOTS])[]

proc ctxFileHeader*(ctx: seq[pointer]): pointer =
  # Returns the file header pointer from the context
  ctx[CTX_FH]
proc ctxSectionHeaders*(ctx: seq[pointer]): pointer =
  # Returns the section headers pointer from the context
  ctx[CTX_SH]
proc ctxSymbolTable*(ctx: seq[pointer]): pointer =
  # Returns the symbol table pointer from the context
  ctx[CTX_SYM]
proc ctxStringTable*(ctx: seq[pointer]): cstring =
  # Returns the string table pointer from the context
  cast[cstring](ctx[CTX_STR])
proc ctxStringTableSize*(ctx: seq[pointer]): uint32 =
  # Returns the string table size from the context
  cast[ptr uint32](ctx[CTX_STRSZ])[]

proc ctxSectionMemory*(ctx: seq[pointer]): var seq[pointer] =
  # Returns the writable section memory from the context
  sectionMem(ctx)

proc ctxImportTable*(ctx: seq[pointer]): var pointer =
  # Returns the writable import table from the context
  importTable(ctx)

proc ctxImportSlots*(ctx: seq[pointer]): var int =
  # Returns the writable import slot count from the context
  importSlots(ctx)

proc newEmptyCtx*(): seq[pointer] =
  # Builds an empty coff context
  var bag = newSeq[pointer](CTX_SIZE)
  bag[CTX_SECMEM] = cast[pointer](cast[ptr seq[pointer]](allocShared0(sizeof(seq[pointer]))))
  cast[ptr seq[pointer]](bag[CTX_SECMEM])[] = @[]
  bag[CTX_IMPTAB] = cast[pointer](cast[ptr pointer](allocShared0(sizeof(pointer))))
  cast[ptr pointer](bag[CTX_IMPTAB])[] = nil
  bag[CTX_IMPSLOTS] = cast[pointer](cast[ptr int](allocShared0(sizeof(int))))
  cast[ptr int](bag[CTX_IMPSLOTS])[] = 0
  bag

proc coffOk*(): (bool, int32, string) =
  # Returns a successful coff result
  (true, 0'i32, "")
proc coffFail*(code: int32): (bool, int32, string) =
  # Returns a failed coff result
  (false, code, "")
