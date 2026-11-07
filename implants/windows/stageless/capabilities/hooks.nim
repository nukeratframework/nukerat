import std/strutils
import ../utils/global
import ../utils/winapi/handlers
import ../utils/winapi/utils
import execution/core

const prologueLen = 16

proc dhPeNt(base: pointer): pointer =
  # Checks the pe signatures and returns the nt headers
  let p = cast[ptr UncheckedArray[byte]](base)
  if p[0] != 0x4D or p[1] != 0x5A:
    return nil
  let nt = cast[pointer](cast[int](base) + u32(base, 0x3C).int)
  if u32(nt) != 0x00004550:
    return nil
  nt

proc dhFnRva(peBase: pointer; apiName: string): culong =
  # Finds the export rva for an api name
  let nt = dhPeNt(peBase)
  if nt == nil:
    return 0
  let expRva = exportRva(nt)
  if expRva == 0:
    return 0
  let exp = rva(peBase, expRva, nt)
  if exp == nil:
    return 0
  let names = rva(peBase, u32(exp, 32), nt)
  let funcs = rva(peBase, u32(exp, 28), nt)
  let ords = rva(peBase, u32(exp, 36), nt)
  if names == nil or funcs == nil or ords == nil:
    return 0
  for i in 0 ..< u32(exp, 24).int:
    let namePtr = rva(peBase, u32(names, i * 4), nt)
    if namePtr == nil:
      continue
    if $cast[cstring](namePtr) != apiName:
      continue
    let ord = cast[ptr uint16](cast[int](ords) + i * 2)[]
    return u32(funcs, ord.int * 4)
  0

proc run_hooks*(buf: var openArray[char]): int =
  # Compares loaded api bytes with the disk image and reports hooks
  type ScanRow = tuple[dll: string; path: string; apis: seq[string]]
  let rows: seq[ScanRow] = @[
    (
      obf("ntdll.dll"),
      obf(r"C:\Windows\System32\ntdll.dll"),
      @[
        obf("NtOpenProcess"), obf("NtWriteVirtualMemory"), obf("NtProtectVirtualMemory"),
        obf("NtCreateThreadEx"),
      ],
    ),
    (
      obf("kernel32.dll"),
      obf(r"C:\Windows\System32\kernel32.dll"),
      @[obf("VirtualAllocEx"), obf("WriteProcessMemory"), obf("CreateRemoteThread")],
    ),
    (
      obf("kernelbase.dll"),
      obf(r"C:\Windows\System32\kernelbase.dll"),
      @[obf("VirtualAllocEx"), obf("WriteProcessMemory")],
    ),
  ]

  var report = ""
  for row in rows:
    let modBase = getModuleHandleA(row.dll)
    if modBase == nil:
      report.add(row.dll & obf(": not loaded\n"))
      continue
    var wpath = newWideCString(row.path)
    let h = createFileW(addr wpath[0], genericRead, 1, nil, openExisting, 0x80, 0)
    if h == invalidHandle:
      report.add(row.dll & obf(": cannot read disk image\n"))
      continue
    defer:
      discard closeHandle(h)
    let sz = getFileSize(h, nil)
    if sz == 0 or sz > 8 * 1024 * 1024:
      report.add(row.dll & obf(": invalid file size\n"))
      continue
    let diskPe = allocRw(sz.csize_t)
    if diskPe == nil:
      report.add(row.dll & obf(": alloc failed\n"))
      continue
    var nr: culong
    if readFile(h, diskPe, sz, addr nr, nil) == 0 or nr != sz:
      discard freeMem(diskPe)
      report.add(row.dll & obf(": read failed\n"))
      continue
    defer:
      discard freeMem(diskPe)

    for api in row.apis:
      let fnRva = dhFnRva(modBase, api)
      if fnRva == 0:
        report.add(row.dll & obf("!") & api & obf(": export not found\n"))
        continue
      let memP = cast[pointer](cast[int](modBase) + fnRva.int)
      let diskP = rva(diskPe, fnRva, dhPeNt(diskPe))
      if diskP == nil:
        report.add(row.dll & obf("!") & api & obf(": disk prologue unreadable\n"))
        continue
      var hooked = false
      let mb = cast[ptr UncheckedArray[byte]](memP)
      let db = cast[ptr UncheckedArray[byte]](diskP)
      for i in 0 ..< prologueLen:
        if mb[i] != db[i]:
          hooked = true
          break
      if hooked:
        var hexMem = ""
        var hexDisk = ""
        for i in 0 ..< prologueLen:
          if i > 0:
            hexMem.add ' '
            hexDisk.add ' '
          hexMem.add toHex(mb[i], 2)
          hexDisk.add toHex(db[i], 2)
        report.add(
          row.dll & obf("!") & api & obf(": HOOKED mem=") & hexMem & obf(" disk=") & hexDisk & '\n',
        )
      else:
        report.add(row.dll & obf("!") & api & obf(": OK\n"))

  if report.len == 0:
    report = obf("No results.")
  writeMsg(report, buf)
