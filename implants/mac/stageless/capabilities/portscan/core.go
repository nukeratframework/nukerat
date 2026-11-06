package portscan

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const (
	maxOpenOutput     = 200
	defaultTimeoutMs  = 1000
	maxTimeoutMs      = 30000
)

func MainPortScan(target, portSpec string, protocol, timeoutMs int) string {
	// Main function that runs the port scan and prints the status
	var lines []string
	tout := timeoutMs
	target = strings.TrimSpace(target)
	if target == "" {
		return "[-] Usage: port-scan <target> [top20|top100|port|port-list|start-end] [protocol: 0=tcp 1=udp 2=both] [timeout_ms]"
	}
	if protocol < 0 || protocol > 2 {
		return "[-] Invalid protocol: use 0=tcp, 1=udp, or 2=both"
	}
	if tout <= 0 || tout > maxTimeoutMs {
		lines = append(lines, "[!] Invalid timeout requested; using "+strconv.Itoa(defaultTimeoutMs)+" ms")
		tout = defaultTimeoutMs
	}
	pspec := portSpec
	if pspec == "" {
		pspec = "top20"
	}
	ports, perr := parsePorts(pspec)
	if perr == "cap" {
		return "[-] Port specification exceeds cap of " + strconv.Itoa(maxPorts) + " ports"
	}
	if perr != "" || len(ports) == 0 {
		return "[-] Invalid port specification: " + pspec
	}
	if !resolveTarget(target) {
		return "[-] Target resolution failed: " + target
	}
	protoLabel := "tcp"
	if protocol == 1 {
		protoLabel = "udp"
	} else if protocol == 2 {
		protoLabel = "tcp+udp"
	}
	lines = append(lines, "[i] Port scan target="+target+" protocol="+protoLabel+
		" timeout_ms="+strconv.Itoa(tout)+" ports="+strconv.Itoa(len(ports)))
	if len(ports) > 200 || protocol == 2 {
		lines = append(lines, "[!] Large scans can trigger firewall, EDR, or IDS alerts; prefer targeted port lists when possible")
	}
	if protocol == 1 || protocol == 2 {
		lines = append(lines, "[!] UDP results only confirm responsive services; no-response can mean open, filtered, or closed")
	}
	var tcpOpen, tcpClosed, tcpErrors int
	var udpResponsive, udpNoResponse, udpErrors int
	var printedOpen, totalChecks int
	for _, port := range ports {
		if protocol == 0 || protocol == 2 {
			r := tcpConnectScan(target, port, tout)
			totalChecks++
			if r == 1 {
				tcpOpen++
				if printedOpen < maxOpenOutput {
					lines = append(lines, "[+] tcp/"+strconv.Itoa(int(port))+" open")
					printedOpen++
				}
			} else if r == 0 {
				tcpClosed++
			} else {
				tcpErrors++
			}
		}
		if protocol == 1 || protocol == 2 {
			r := udpProbe(target, port, tout)
			totalChecks++
			if r == 1 {
				udpResponsive++
				if printedOpen < maxOpenOutput {
					lines = append(lines, "[+] udp/"+strconv.Itoa(int(port))+" responsive")
					printedOpen++
				}
			} else if r == 0 {
				udpNoResponse++
			} else {
				udpErrors++
			}
		}
	}
	if (tcpOpen + udpResponsive) > printedOpen {
		lines = append(lines, "[!] Output truncated: displayed "+strconv.Itoa(printedOpen)+" of "+
			strconv.Itoa(tcpOpen+udpResponsive)+" open/responsive results")
	}
	lines = append(lines, "[i] Summary target="+target+" checks="+strconv.Itoa(totalChecks)+
		" tcp_open="+strconv.Itoa(tcpOpen)+" tcp_closed="+strconv.Itoa(tcpClosed)+" tcp_errors="+strconv.Itoa(tcpErrors)+
		" udp_responsive="+strconv.Itoa(udpResponsive)+" udp_no_response="+strconv.Itoa(udpNoResponse)+
		" udp_errors="+strconv.Itoa(udpErrors))
	return strings.Join(lines, "\n")
}

func paramStr(params, key string) string {
	// Reads a trimmed string param from the json payload
	if params == "" {
		return ""
	}
	var p map[string]interface{}
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return ""
	}
	v, ok := p[key]
	if !ok {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(strings.TrimSpace(fmt.Sprint(v)))
	}
}

func RunPortscan(args, params string) []byte {
	// Receives the port scan args and returns the scan output
	target := paramStr(params, "target")
	portSpec := paramStr(params, "ports")
	if portSpec == "" {
		portSpec = paramStr(params, "port")
	}
	if portSpec == "" {
		portSpec = paramStr(params, "flag")
	}
	protoStr := paramStr(params, "protocol")
	if protoStr == "" {
		protoStr = paramStr(params, "method")
	}
	timeoutStr := paramStr(params, "timeout_ms")
	if timeoutStr == "" {
		timeoutStr = paramStr(params, "delay")
	}
	tail := strings.TrimSpace(args)
	if tail != "" {
		parts := strings.Fields(tail)
		if target == "" && len(parts) > 0 {
			target = parts[0]
		}
		if portSpec == "" && len(parts) > 1 {
			portSpec = parts[1]
		}
		if protoStr == "" && len(parts) > 2 {
			protoStr = parts[2]
		}
		if timeoutStr == "" && len(parts) > 3 {
			timeoutStr = parts[3]
		}
	}
	protocol := 0
	if protoStr != "" {
		protocol, _ = strconv.Atoi(protoStr)
	}
	timeoutMs := defaultTimeoutMs
	if timeoutStr != "" {
		if v, err := strconv.Atoi(timeoutStr); err == nil {
			timeoutMs = v
		}
	}
	msg := MainPortScan(target, portSpec, protocol, timeoutMs)
	return []byte(msg)
}
