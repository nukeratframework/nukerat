import std/[json, options, parseutils, strutils]
import ../execution/core
import utils

const max_open_output = 200
const default_timeout_ms = 1000
const max_timeout_ms = 30000

proc main_port_scan*(
    target: string;
    port_spec: string = obf("top20");
    protocol: int = 0;
    timeout_ms: int = default_timeout_ms
): string =
  # Main function that runs the port scan and builds the report
  var lines: seq[string] = @[]
  var tout = timeout_ms
  if target.strip.len == 0:
    return obf("[-] Usage: port-scan <target> [top20|top100|port|port-list|start-end] [protocol: 0=tcp 1=udp 2=both] [timeout_ms]")

  if protocol < 0 or protocol > 2:
    return obf("[-] Invalid protocol: use 0=tcp, 1=udp, or 2=both")

  if tout <= 0 or tout > max_timeout_ms:
    lines.add(obf("[!] Invalid timeout requested; using ") & $default_timeout_ms & obf(" ms"))
    tout = default_timeout_ms

  let pspec = if port_spec.len == 0: obf("top20") else: port_spec
  let (ports, perr) = parse_ports(pspec)
  if perr == obf("cap"):
    return obf("[-] Port specification exceeds cap of ") & $max_ports & obf(" ports")
  if perr.len > 0 or ports.len == 0:
    return obf("[-] Invalid port specification: ") & pspec

  if not ensure_winsock():
    return obf("[-] Failed to initialize Winsock")
  let addrOpt = resolve_target_ipv4(target)
  if addrOpt.isNone:
    return obf("[-] Target resolution failed: ") & target
  let target_addr = addrOpt.get

  var proto_label = obf("tcp")
  if protocol == 1:
    proto_label = obf("udp")
  elif protocol == 2:
    proto_label = obf("tcp+udp")

  lines.add(obf("[i] Port scan target=") & target & obf(" protocol=") & proto_label &
    obf(" timeout_ms=") & $tout & obf(" ports=") & $ports.len)

  if ports.len > 200 or protocol == 2:
    lines.add(obf("[!] Large scans can trigger firewall, EDR, or IDS alerts; prefer targeted port lists when possible"))
  if protocol == 1 or protocol == 2:
    lines.add(obf("[!] UDP results only confirm responsive services; no-response can mean open, filtered, or closed"))

  var tcp_open = 0
  var tcp_closed = 0
  var tcp_errors = 0
  var udp_responsive = 0
  var udp_no_response = 0
  var udp_errors = 0
  var printed_open = 0
  var total_checks = 0

  for port in ports:
    if protocol == 0 or protocol == 2:
      let r = tcp_connect_scan(target_addr, port, tout)
      total_checks += 1
      if r == 1:
        tcp_open += 1
        if printed_open < max_open_output:
          lines.add(obf("[+] tcp/") & $port & obf(" open"))
          printed_open += 1
      elif r == 0:
        tcp_closed += 1
      else:
        tcp_errors += 1

    if protocol == 1 or protocol == 2:
      let r = udp_probe(target_addr, port, tout)
      total_checks += 1
      if r == 1:
        udp_responsive += 1
        if printed_open < max_open_output:
          lines.add(obf("[+] udp/") & $port & obf(" responsive"))
          printed_open += 1
      elif r == 0:
        udp_no_response += 1
      else:
        udp_errors += 1

  if (tcp_open + udp_responsive) > printed_open:
    lines.add(obf("[!] Output truncated: displayed ") & $printed_open & obf(" of ") &
      $(tcp_open + udp_responsive) & obf(" open/responsive results"))

  lines.add(obf("[i] Summary target=") & target & obf(" checks=") & $total_checks &
    obf(" tcp_open=") & $tcp_open & obf(" tcp_closed=") & $tcp_closed & obf(" tcp_errors=") & $tcp_errors &
    obf(" udp_responsive=") & $udp_responsive & obf(" udp_no_response=") & $udp_no_response &
    obf(" udp_errors=") & $udp_errors)

  lines.join(obf("\n"))

proc param_str(params: string; key: string): string =
  # Reads a string field from the json params
  try:
    let p = parseJson(params)
    if p.hasKey(key):
      return p[key].getStr().strip()
  except JsonParsingError:
    discard
  ""

proc run_portscan*(args, params: string; buf: var openArray[char]): int =
  # Entrypoint that parses the args and runs the port scan
  var target = param_str(params, obf("target"))
  var port_spec = param_str(params, obf("ports"))
  if port_spec.len == 0:
    port_spec = param_str(params, obf("port"))
  if port_spec.len == 0:
    port_spec = param_str(params, obf("flag"))
  var proto_str = param_str(params, obf("protocol"))
  if proto_str.len == 0:
    proto_str = param_str(params, obf("method"))
  var timeout_str = param_str(params, obf("timeout_ms"))
  if timeout_str.len == 0:
    timeout_str = param_str(params, obf("delay"))

  let tail = args.strip()
  if tail.len > 0:
    let parts = tail.split({' ', '\t'}, 0)
    if target.len == 0 and parts.len > 0:
      target = parts[0]
    if port_spec.len == 0 and parts.len > 1:
      port_spec = parts[1]
    if proto_str.len == 0 and parts.len > 2:
      proto_str = parts[2]
    if timeout_str.len == 0 and parts.len > 3:
      timeout_str = parts[3]

  var protocol = 0
  if proto_str.len > 0:
    discard parseInt(proto_str, protocol)
  var timeout_ms = default_timeout_ms
  if timeout_str.len > 0:
    discard parseInt(timeout_str, timeout_ms)

  writeMsg(main_port_scan(target, port_spec, protocol, timeout_ms), buf)
