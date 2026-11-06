import std/[json, parseutils, strutils]
import ../execution
import utils

const max_open_output = 200
const default_timeout_ms = 1000
const max_timeout_ms = 30000

proc main_port_scan*(
    target: string;
    port_spec: string = "top20";
    protocol: int = 0;
    timeout_ms: int = default_timeout_ms
): string =
  # Main function that runs the port scan and builds the result text
  var lines: seq[string] = @[]
  var tout = timeout_ms
  if target.strip.len == 0:
    return "[-] Usage: port-scan <target> [top20|top100|port|port-list|start-end] [protocol: 0=tcp 1=udp 2=both] [timeout_ms]"

  if protocol < 0 or protocol > 2:
    return "[-] Invalid protocol: use 0=tcp, 1=udp, or 2=both"

  if tout <= 0 or tout > max_timeout_ms:
    lines.add("[!] Invalid timeout requested; using " & $default_timeout_ms & " ms")
    tout = default_timeout_ms

  let pspec = if port_spec.len == 0: "top20" else: port_spec
  let (ports, perr) = parse_ports(pspec)
  if perr == "cap":
    return "[-] Port specification exceeds cap of " & $max_ports & " ports"
  if perr != nil or ports.len == 0:
    return "[-] Invalid port specification: " & pspec

  if not resolve_target(target):
    return "[-] Target resolution failed: " & target

  var proto_label = "tcp"
  if protocol == 1:
    proto_label = "udp"
  elif protocol == 2:
    proto_label = "tcp+udp"

  lines.add("[i] Port scan target=" & target & " protocol=" & proto_label &
    " timeout_ms=" & $tout & " ports=" & $ports.len)

  if ports.len > 200 or protocol == 2:
    lines.add("[!] Large scans can trigger firewall, EDR, or IDS alerts; prefer targeted port lists when possible")
  if protocol == 1 or protocol == 2:
    lines.add("[!] UDP results only confirm responsive services; no-response can mean open, filtered, or closed")

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
      let r = tcp_connect_scan(target, port, tout)
      total_checks += 1
      if r == 1:
        tcp_open += 1
        if printed_open < max_open_output:
          lines.add("[+] tcp/" & $port & " open")
          printed_open += 1
      elif r == 0:
        tcp_closed += 1
      else:
        tcp_errors += 1

    if protocol == 1 or protocol == 2:
      let r = udp_probe(target, port, tout)
      total_checks += 1
      if r == 1:
        udp_responsive += 1
        if printed_open < max_open_output:
          lines.add("[+] udp/" & $port & " responsive")
          printed_open += 1
      elif r == 0:
        udp_no_response += 1
      else:
        udp_errors += 1

  if (tcp_open + udp_responsive) > printed_open:
    lines.add("[!] Output truncated: displayed " & $printed_open & " of " &
      $(tcp_open + udp_responsive) & " open/responsive results")

  lines.add("[i] Summary target=" & target & " checks=" & $total_checks &
    " tcp_open=" & $tcp_open & " tcp_closed=" & $tcp_closed & " tcp_errors=" & $tcp_errors &
    " udp_responsive=" & $udp_responsive & " udp_no_response=" & $udp_no_response &
    " udp_errors=" & $udp_errors)

  lines.join("\n")

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
  # Entrypoint that reads the port scan args and writes the result
  var target = param_str(params, "target")
  var port_spec = param_str(params, "ports")
  if port_spec.len == 0:
    port_spec = param_str(params, "port")
  if port_spec.len == 0:
    port_spec = param_str(params, "flag")
  var proto_str = param_str(params, "protocol")
  if proto_str.len == 0:
    proto_str = param_str(params, "method")
  var timeout_str = param_str(params, "timeout_ms")
  if timeout_str.len == 0:
    timeout_str = param_str(params, "delay")

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
