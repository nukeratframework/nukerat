package tasks

import (
	"encoding/json"
	"strings"

	"stageless/utils/obf"
)

func ParamValue(params string, jsonKey string, flags []string) string {
	// Reads a parameter from JSON or from flag args
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return ""
	}
	if v, ok := p[jsonKey].(string); ok {
		return strings.Trim(v, "\"'")
	}
	argsRaw, ok := p[obf.S("args")]
	if !ok {
		return ""
	}
	argsStr, ok := argsRaw.(string)
	if !ok {
		return ""
	}
	parts := strings.Fields(argsStr)
	for i := 0; i < len(parts); i++ {
		for _, flag := range flags {
			if parts[i] == flag && i+1 < len(parts) {
				return strings.Trim(parts[i+1], "\"'")
			}
		}
	}
	return ""
}
