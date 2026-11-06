package general

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"

	"stageless/utils/obf"
)

func DigestHex(s string) string {
	// Returns the md5 digest of a string as hex
	h := md5.Sum([]byte(s))
	out := hex.EncodeToString(h[:])
	return out
}

func TagFromSource(src string) string {
	// Builds a short tag from hex digits in the source
	var clean strings.Builder
	for _, c := range src {
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			clean.WriteRune(c)
		}
	}
	out := clean.String()
	if len(out) < 5 {
		out = DigestHex(src)
	}
	if len(out) < 5 {
		return "00000"
	}
	return out[:5]
}

func ParsePortDigits(s string) int {
	// Parses a port from digit characters
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 || n > 65535 {
		return 0
	}
	return n
}

func FmtSize(sz uint64) string {
	// Formats a byte size as a short string
	const kb = 1024
	const mb = kb * 1024
	const gb = mb * 1024
	if sz < kb {
		return strconv.FormatUint(sz, 10) + " B"
	}
	var div uint64
	var sfx string
	switch {
	case sz < mb:
		div, sfx = kb, "KB"
	case sz < gb:
		div, sfx = mb, "MB"
	default:
		div, sfx = gb, "GB"
	}
	whole := sz / div
	frac := (sz % div) * 10 / div
	return strconv.FormatUint(whole, 10) + "." + strconv.FormatUint(frac, 10) + sfx
}

func ClipText(s string, n int) string {
	// Clips a string to a maximum length
	if n <= 0 {
		n = 512
	}
	if len(s) <= n {
		return s
	}
	return s[:n] + obf.S("...")
}

func JSONKeysList(pkt map[string]any) string {
	// Builds a list of json keys from a map
	keys := make([]string, 0, len(pkt))
	for k := range pkt {
		keys = append(keys, k)
	}
	return obf.S("[") + strings.Join(keys, ",") + obf.S("]")
}

func ParsePortInt(raw string) int {
	// Parses a port number from a string
	raw = strings.TrimSpace(raw)
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 || n > 65535 {
		return 0
	}
	return n
}

func ParseHostPort(raw string, defaultPort int) (string, int) {
	// Splits a host and port from a string
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", 0
	}
	host := value
	port := defaultPort
	if i := strings.LastIndex(value, ":"); i > 0 {
		maybe := value[i+1:]
		if p, err := strconv.Atoi(maybe); err == nil && p > 0 && p <= 65535 {
			host = strings.TrimSpace(value[:i])
			port = p
		}
	}
	return host, port
}

func TargetSchemeParts(raw string) (string, string) {
	// Splits a scheme and the rest of a target string
	v := strings.TrimSpace(raw)
	schemeSep := obf.S("://")
	if idx := strings.Index(v, schemeSep); idx > 0 {
		return strings.ToLower(v[:idx]), strings.TrimSpace(v[idx+len(schemeSep):])
	}
	return obf.S("implant"), v
}

func ParseRelayEndpoint(raw, transport string) map[string]any {
	// Builds a relay endpoint map from host and port
	defaultPort := 0
	if transport == obf.S("smb") {
		defaultPort = 445
	}
	host, port := ParseHostPort(raw, defaultPort)
	return map[string]any{
		obf.S("scheme"): transport,
		obf.S("host"):   host,
		obf.S("port"):   port,
	}
}

func ArgsColonTable(raw string) map[string]string {
	// Parses colon separated tokens into a table
	tbl := map[string]string{}
	for _, token := range strings.Fields(raw) {
		idx := strings.Index(token, ":")
		if idx <= 0 {
			continue
		}
		tbl[strings.ToLower(token[:idx])] = token[idx+1:]
	}
	return tbl
}

func MarshalJSON(v any) string {
	// Marshals a value to a json string
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}
