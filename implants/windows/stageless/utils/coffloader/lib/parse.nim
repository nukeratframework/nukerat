import ./types

proc fail*(code: int32): (bool, int32, string) =
  # Returns a coff failure result
  coffFail(code)

proc checkBounds*(data: openArray[byte], offset: int, size: int): (bool, int32, string) =
  # Checks that an offset and size stay inside the buffer
  if offset < 0 or size < 0 or offset > data.len or size > data.len - offset:
    return fail(1)
  coffOk()

proc readFixedName*(base: pointer): string =
  # Reads a fixed length name from a header field
  var len = 8
  while len > 0 and cast[ptr char](cast[int](base) + len - 1)[] == '\0':
    dec len
  result = newString(len)
  if len > 0:
    copyMem(result[0].addr, cast[pointer](base), len)

proc readStringTableName*(ctx: seq[pointer], offset: uint32): string =
  # Reads a name from the coff string table
  let base = cast[int](ctxStringTable(ctx))
  let off = cast[int](offset)
  let sz = ctxStringTableSize(ctx).int
  if base == 0 or off <= 0 or off >= sz:
    return ""
  var cursor = base + off
  let limit = base + sz
  while cursor < limit:
    let ch = cast[ptr char](cursor)[]
    if ch == '\0':
      break
    result.add ch
    inc cursor

proc readSymbolName*(ctx: seq[pointer], entry: pointer): string =
  # Reads the name of a coff symbol
  if symU32(entry, 0) == 0:
    readStringTableName(ctx, symU32(entry, 4))
  else:
    readFixedName(entry)

proc symbolIsDefined*(entry: pointer): bool =
  # Checks that the symbol is defined in a section
  symU16(entry, 12) > 0

proc symbolIsExternal*(entry: pointer): bool =
  # Checks that the symbol storage class is external
  let sc = symU8(entry, 16)
  sc in [IMAGE_SYM_CLASS_EXTERNAL, IMAGE_SYM_CLASS_EXTERNAL_DEF]

proc bofArgsProvided*(args: pointer; argsSize: uint32): bool =
  # Checks that bof arguments were provided
  if args == nil or argsSize < 4:
    return false
  cast[ptr uint32](args)[] > 0'u32

proc validateCoff*(data: openArray[byte]): (seq[pointer], (bool, int32, string)) =
  # Validates the coff bytes and builds the context
  if data.len < SZ_FILE_HEADER:
    return (newSeq[pointer](0), fail(1))

  var stored = newSeq[byte](data.len)
  copyMem(addr stored[0], unsafeAddr data[0], data.len)

  let fileHeader = cast[pointer](addr stored[0])
  if fhU16(fileHeader, 0) != IMAGE_FILE_MACHINE_AMD64:
    return (newSeq[pointer](0), fail(1))

  let headerSize = SZ_FILE_HEADER + int(fhU16(fileHeader, 16))
  var check = checkBounds(stored, headerSize, SZ_SECTION_HEADER * int(fhU16(fileHeader, 2)))
  if not check[0]:
    return (newSeq[pointer](0), check)

  if int(fhU32(fileHeader, 8)) < headerSize:
    return (newSeq[pointer](0), fail(1))

  let symOff = int(fhU32(fileHeader, 8))
  check = checkBounds(stored, symOff, SZ_SYMBOL * int(fhU32(fileHeader, 12)))
  if not check[0]:
    return (newSeq[pointer](0), check)

  let strTabIndex = symOff + SZ_SYMBOL * int(fhU32(fileHeader, 12))
  check = checkBounds(stored, strTabIndex, 4)
  if not check[0]:
    return (newSeq[pointer](0), check)

  let strTabSize = cast[ptr uint32](addr stored[strTabIndex])[]
  check = checkBounds(stored, strTabIndex, strTabSize.int)
  if not check[0]:
    return (newSeq[pointer](0), check)

  if stored.len != strTabIndex + strTabSize.int:
    return (newSeq[pointer](0), fail(1))

  var ctx = newEmptyCtx()
  let storedPtr = cast[ptr seq[byte]](allocShared0(sizeof(seq[byte])))
  if storedPtr == nil:
    return (ctx, fail(1))
  storedPtr[] = stored
  ctx[CTX_DATA] = cast[pointer](storedPtr)
  ctx[CTX_FH] = cast[pointer](addr storedPtr[][0])
  ctx[CTX_SH] = cast[pointer](addr storedPtr[][headerSize])
  ctx[CTX_SYM] = cast[pointer](addr storedPtr[][symOff])
  ctx[CTX_STR] = cast[pointer](addr storedPtr[][strTabIndex + 4])
  let strSzPtr = cast[ptr uint32](allocShared0(sizeof(uint32)))
  if strSzPtr == nil:
    return (ctx, fail(1))
  strSzPtr[] = strTabSize - 4'u32
  ctx[CTX_STRSZ] = cast[pointer](strSzPtr)
  (ctx, coffOk())
