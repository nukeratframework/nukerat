import std/strutils
import ../../utils/global
import ../../utils/general/strings
from ../../utils/winapi/handlers import createProcessW, createPipe,
    setHandleInformation, getStdHandle, closeHandle, getFileAttributesW,
    findFirstFileW, findNextFileW, findClose, getUserNameW
from ../../utils/winapi/syscall import readFile, waitForObject, ntCloseHandle, openProcess
from ../../utils/winapi/utils import SECURITY_ATTRIBUTES

type
  ProcessInformation* = object
    hProcess*, hThread*: pointer
    dwProcessId*, dwThreadId*: uint32
  StartupInfoW* = object
    cb: culong
    reserved, desktop, title: pointer
    x, y, xSize, ySize, xCountChars, yCountChars, fillAttribute, flags: culong
    showWindow: uint16
    cbReserved2: uint16
    lpReserved2: pointer
    hStdInput, hStdOutput, hStdError: pointer

proc placeholder_resolve*(path: string): string =
  # Resolves path placeholders such as user and version
  type Wchar = uint16
  const
    fileAttributeDirectory = 0x10'u32
    invalidFileAttributes = 0xFFFFFFFF'u32
    invalidFindHandle = cast[pointer](-1)

  proc fileExists(p: string): bool =
    # Checks that a candidate path exists on disk
    if p.len == 0:
      return false
    var w: array[520, uint16]
    asciiWide(p, w)
    getFileAttributesW(addr w[0]) != invalidFileAttributes

  proc entryName(data: openArray[byte]): string =
    # Reads the file name from a find data buffer
    let namePtr = cast[ptr UncheckedArray[Wchar]](unsafeAddr data[44])
    var nameArr: array[260, uint16]
    var i = 0
    while i < nameArr.high and namePtr[i] != 0'u16:
      nameArr[i] = namePtr[i]
      inc i
    nameArr[i] = 0'u16
    var cbuf: array[260, char]
    let n = wtoa(nameArr, cbuf)
    if n <= 0:
      return ""
    result = newString(n)
    copyMem(addr result[0], addr cbuf[0], n)

  proc pickDirSegment(prefix, suffix: string): string =
    # Finds a directory name that completes the path
    if prefix.len == 0:
      return ""
    var scan = prefix
    if scan[^1] != '\\':
      scan &= '\\'
    var wpat: array[560, uint16]
    asciiWide(scan & "*", wpat)
    var data: array[592, byte]
    let h = findFirstFileW(addr wpat[0], addr data[0])
    if h == invalidFindHandle:
      return ""
    defer:
      discard findClose(h)
    while true:
      let name = entryName(data)
      if name.len > 0 and name != "." and name != "..":
        let attrs = rdLe32(data, 0)
        if (attrs and fileAttributeDirectory) != 0:
          let candidate = scan & name & suffix
          if fileExists(candidate):
            return name
      zeroMem(addr data[0], data.len)
      if findNextFileW(h, addr data[0]) == 0:
        break
    ""

  result = path
  if result.len == 0:
    return

  if result.find(obf("<username>")) >= 0 or result.find(obf("<user>")) >= 0:
    var userW: array[256, Wchar]
    var userLen = culong(userW.len)
    if getUserNameW(addr userW[0], addr userLen) != 0:
      let user = wideToAscii(addr userW[0], culong((userLen + 1) * 2))
      if user.len > 0:
        result = result.replace(obf("<username>"), user)
        result = result.replace(obf("<user>"), user)

  block resolveLoop:
    while true:
      var token = ""
      if result.find(obf("<version_packageid>")) >= 0:
        token = obf("<version_packageid>")
      elif result.find(obf("<VERSION>")) >= 0:
        token = obf("<VERSION>")
      elif result.find(obf("<version>")) >= 0:
        token = obf("<version>")
      else:
        break
      let idx = result.find(token)
      if idx < 0:
        break
      let pre = result[0 ..< idx]
      let suf = result[idx + token.len .. ^1]
      let seg = pickDirSegment(pre, suf)
      if seg.len == 0:
        break
      result = pre & seg & suf

proc path_exists*(path: string): bool =
  # Checks that the path exists on disk
  const invalidFileAttributes = 0xFFFFFFFF'u32
  if path.len == 0:
    return false
  var w: array[520, uint16]
  asciiWide(path, w)
  getFileAttributesW(addr w[0]) != invalidFileAttributes

proc open_pid_query*(pid: uint32): pointer =
  # Opens a process handle for a limited query
  const processQueryLimited = 0x1000'u32
  if pid == 0:
    return nil
  openProcess(culong(pid), processQueryLimited)

proc run_bin_capture*(binPath, extraArgs: string; buf: var openArray[char]): int =
  # Runs a binary and copies its output into the buffer
  const
    startfUseStdHandles = 0x100'u32
    handleFlagInherit = 1'u32
    createNoWindow = 0x08000000'u32
    stdInputHandle = 0xFFFFFFF6'u32
    maxCmdLen = 4096


  var cmdLine = "\"" & binPath & "\""
  let tail = extraArgs.strip()
  if tail.len > 0:
    cmdLine &= " " & tail
  if cmdLine.len >= maxCmdLen:
    return -1

  var hRead, hWrite: pointer
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES), lpSecurityDescriptor: nil,
        bInheritHandle: 1)
  if createPipe(addr hRead, addr hWrite, addr sa, 1024 * 1024) == 0:
    return -2
  if setHandleInformation(hRead, handleFlagInherit, 0) == 0:
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return -2

  var wcmd: array[maxCmdLen, uint16]
  asciiWide(cmdLine, wcmd)
  var si: StartupInfoW
  zeroMem(addr si, sizeof(si))
  si.cb = culong sizeof(StartupInfoW)
  si.flags = startfUseStdHandles
  si.hStdInput = getStdHandle(stdInputHandle)
  si.hStdOutput = hWrite
  si.hStdError = hWrite
  var pi: ProcessInformation
  zeroMem(addr pi, sizeof(pi))
  if createProcessW(nil, addr wcmd[0], nil, nil, 1, createNoWindow, nil, nil,
      addr si, addr pi) == 0:
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return -3

  discard closeHandle(hWrite)
  discard waitForObject(pi.hProcess)
  var pos = 0
  var chunk: array[4096, byte]
  while pos < buf.len:
    let rd = readFile(hRead, addr chunk[0], culong(min(chunk.len, buf.len - pos)))
    if rd == 0:
      break
    copyMem(addr buf[pos], addr chunk[0], int(rd))
    pos += int(rd)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  discard closeHandle(hRead)
  pos
