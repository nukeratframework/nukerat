package capabilities

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"

	"stageless/utils/obf"
)

func RunPreview(args, params string) []byte {
	// Reads a limited preview of a file
	path := strings.TrimSpace(args)
	if path == "" {
		return WriteMsg(obf.S("Error: missing path"))
	}
	limit := 4096
	if params != "" {
		var p map[string]any
		if err := json.Unmarshal([]byte(params), &p); err == nil {
			if v, ok := p[obf.S("size_limit")]; ok {
				switch t := v.(type) {
				case float64:
					if int(t) > 0 {
						limit = int(t)
					}
				case int:
					if t > 0 {
						limit = t
					}
				case string:
					if n, err := strconv.Atoi(strings.Trim(t, "\"'")); err == nil && n > 0 {
						limit = n
					}
				}
			}
		}
	}
	if limit > bufCap {
		limit = bufCap
	}
	f, err := os.Open(path)
	if err != nil {
		return WriteMsg(obf.S("Error: cannot open file"))
	}
	defer f.Close()
	data := make([]byte, limit)
	n, _ := f.Read(data)
	return data[:n]
}
