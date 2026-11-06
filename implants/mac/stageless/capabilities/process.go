package capabilities

import (
	general "stageless/utils/general"
	"stageless/utils/macapi"
	"stageless/utils/obf"
)

func RunProcess(host, taskTag, input, params string) []byte {
	// Builds the process tree message and returns it
	_ = input
	_ = params
	msg := general.MarshalJSON(map[string]any{
		obf.S("option"):   obf.S("output"),
		obf.S("type"):     obf.S("process"),
		obf.S("host"):     host,
		obf.S("task_tag"): taskTag,
		obf.S("tree"):     macapi.ProcessTreeJSON(),
	})
	return WriteMsg(msg)
}
