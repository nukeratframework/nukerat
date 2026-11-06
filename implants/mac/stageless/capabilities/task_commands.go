package capabilities

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"stageless/utils/obf"
	"stageless/utils/tasks"
)

func RunTasksList(taskTag string) string {
	// Builds the list of running background tasks
	var skipID uint32
	if taskTag != "" {
		ok, t := tasks.ReadTaskExport(0, taskTag)
		if ok {
			skipID = t.ID
		}
	}
	var lines []string
	for _, wid := range tasks.ThreadOrder() {
		ok, tr := tasks.ReadThreadExport(wid)
		if ok && tr.Alive && tr.TaskID != skipID {
			lines = append(lines, obf.S("[ ")+fmt.Sprint(tr.TaskID)+obf.S(" ] ")+tr.Name+"\n")
		}
	}
	if len(lines) == 0 {
		return obf.S("(empty)\n")
	}
	return strings.Join(lines, "")
}

func RunTasksKill(params string) string {
	// Receives the task id and stops that running task
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return obf.S("Kill failed: bad parameters")
	}
	argsRaw, ok := p[obf.S("args")]
	if !ok {
		return obf.S("Kill failed: missing args")
	}
	idStr := ""
	switch v := argsRaw.(type) {
	case string:
		idStr = strings.TrimSpace(v)
	case float64:
		idStr = strings.TrimSpace(strconv.FormatInt(int64(v), 10))
	default:
		b, _ := json.Marshal(v)
		idStr = strings.TrimSpace(string(b))
	}
	if idStr == "" {
		return obf.S("Kill failed: empty id")
	}
	taskID64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return obf.S("Kill failed: invalid id")
	}
	taskID := uint32(taskID64)
	for _, wid := range tasks.ThreadOrder() {
		ok, tr := tasks.ReadThreadExport(wid)
		if !ok || tr.TaskID != taskID || !tr.Alive {
			continue
		}
		tasks.DeleteThreadExport(wid)
		tasks.DeleteTask(taskID)
		return obf.S("Task killed.")
	}
	return obf.S("Kill failed: task not running")
}
