package portscan

import (
	"net"
	"strconv"
	"strings"
	"time"

	"stageless/utils/obf"
)

const maxPorts = 1024

var top20Ports = []string{
	obf.S("21"), obf.S("22"), obf.S("23"), obf.S("25"), obf.S("53"), obf.S("80"), obf.S("110"), obf.S("111"), obf.S("135"), obf.S("139"),
	obf.S("143"), obf.S("443"), obf.S("445"), obf.S("993"), obf.S("995"), obf.S("1723"), obf.S("3306"), obf.S("3389"), obf.S("5900"), obf.S("8080"),
}

var top100Ports = []string{
	obf.S("7"), obf.S("9"), obf.S("13"), obf.S("21"), obf.S("22"), obf.S("23"), obf.S("25"), obf.S("26"), obf.S("37"), obf.S("53"), obf.S("79"), obf.S("80"), obf.S("81"), obf.S("88"), obf.S("106"), obf.S("110"), obf.S("111"), obf.S("113"), obf.S("119"), obf.S("135"),
	obf.S("139"), obf.S("143"), obf.S("144"), obf.S("179"), obf.S("199"), obf.S("389"), obf.S("427"), obf.S("443"), obf.S("444"), obf.S("445"), obf.S("465"), obf.S("513"), obf.S("514"), obf.S("515"), obf.S("543"), obf.S("544"), obf.S("548"),
	obf.S("554"), obf.S("587"), obf.S("631"), obf.S("646"), obf.S("873"), obf.S("990"), obf.S("993"), obf.S("995"), obf.S("1025"), obf.S("1026"), obf.S("1027"), obf.S("1028"), obf.S("1029"), obf.S("1110"), obf.S("1433"),
	obf.S("1720"), obf.S("1723"), obf.S("1755"), obf.S("1900"), obf.S("2000"), obf.S("2001"), obf.S("2049"), obf.S("2121"), obf.S("2717"), obf.S("3000"), obf.S("3128"), obf.S("3306"), obf.S("3389"), obf.S("3986"),
	obf.S("4899"), obf.S("5000"), obf.S("5009"), obf.S("5051"), obf.S("5060"), obf.S("5101"), obf.S("5190"), obf.S("5357"), obf.S("5432"), obf.S("5631"), obf.S("5666"), obf.S("5800"), obf.S("5900"), obf.S("6000"),
	obf.S("6646"), obf.S("7070"), obf.S("8000"), obf.S("8008"), obf.S("8009"), obf.S("8080"), obf.S("8081"), obf.S("8443"), obf.S("8888"), obf.S("9100"), obf.S("9999"), obf.S("10000"), obf.S("32768"), obf.S("49152"),
	obf.S("49153"), obf.S("49154"), obf.S("49155"), obf.S("49156"), obf.S("49157"),
}

func portsFromObf(entries []string) []int32 {
	// Converts the obfuscated port strings into port numbers
	out := make([]int32, 0, len(entries))
	for _, e := range entries {
		n, err := strconv.Atoi(e)
		if err == nil {
			out = append(out, int32(n))
		}
	}
	return out
}

func parseUintSlice(s string, hi int) (int32, bool) {
	// Parses a numeric string into a port number inside the given limit
	if s == "" {
		return 0, false
	}
	var n int64
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, false
		}
		d := int64(ch - '0')
		if n > (int64(hi)-d)/10 {
			return 0, false
		}
		n = n*10 + d
	}
	return int32(n), true
}

func parsePorts(spec string) ([]int32, string) {
	// Parses the port specification into a list of ports
	if spec == "" {
		return nil, "invalid"
	}
	if spec == "top20" {
		if len(top20Ports) > maxPorts {
			return nil, "cap"
		}
		return portsFromObf(top20Ports), ""
	}
	if spec == "top100" {
		if len(top100Ports) > maxPorts {
			return nil, "cap"
		}
		return portsFromObf(top100Ports), ""
	}
	if strings.Contains(spec, "-") {
		parts := strings.SplitN(spec, "-", 2)
		start, ok1 := parseUintSlice(parts[0], 65535)
		endp, ok2 := parseUintSlice(parts[1], 65535)
		if !ok1 || !ok2 || start < 1 || endp > 65535 || start > endp {
			return nil, "invalid"
		}
		if int(endp-start+1) > maxPorts {
			return nil, "cap"
		}
		out := make([]int32, 0, endp-start+1)
		for p := start; p <= endp; p++ {
			out = append(out, p)
		}
		return out, ""
	}
	if strings.Contains(spec, ",") || strings.Contains(spec, " ") {
		out := make([]int32, 0)
		for _, part := range strings.FieldsFunc(spec, func(r rune) bool {
			// Checks that the rune is a comma or a space
			return r == ',' || r == ' '
		}) {
			token := strings.TrimSpace(part)
			if token == "" {
				continue
			}
			n, ok := parseUintSlice(token, 65535)
			if !ok || n < 1 {
				return nil, "invalid"
			}
			if len(out) >= maxPorts {
				return nil, "cap"
			}
			out = append(out, n)
		}
		if len(out) == 0 {
			return nil, "invalid"
		}
		return out, ""
	}
	if n, ok := parseUintSlice(spec, 65535); ok && n >= 1 {
		return []int32{n}, ""
	}
	return nil, "invalid"
}

func resolveTarget(host string) bool {
	// Checks that the target host resolves
	if strings.TrimSpace(host) == "" {
		return false
	}
	_, err := net.LookupHost(host)
	return err == nil
}

func tcpConnectScan(host string, port int32, timeoutMs int) int {
	// Tries a tcp connect to the host and port
	addr := net.JoinHostPort(host, strconv.Itoa(int(port)))
	conn, err := net.DialTimeout("tcp", addr, time.Duration(timeoutMs)*time.Millisecond)
	if err != nil {
		return 0
	}
	conn.Close()
	return 1
}

func udpProbe(host string, port int32, timeoutMs int) int {
	// Sends an empty udp probe and checks for a response
	addr := net.JoinHostPort(host, strconv.Itoa(int(port)))
	conn, err := net.DialTimeout("udp", addr, time.Duration(timeoutMs)*time.Millisecond)
	if err != nil {
		return -1
	}
	defer conn.Close()
	deadline := time.Now().Add(time.Duration(timeoutMs) * time.Millisecond)
	_ = conn.SetDeadline(deadline)
	_, err = conn.Write([]byte{})
	if err != nil {
		return -1
	}
	buf := make([]byte, 1)
	n, _ := conn.Read(buf)
	if n > 0 {
		return 1
	}
	return 0
}
