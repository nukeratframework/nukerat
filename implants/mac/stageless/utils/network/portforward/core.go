package portforward

import (
	"net"
	"strconv"
	"sync"
)

var (
	mu  sync.Mutex
	fds = map[string]net.Conn{}
)

func Connect(key, host string, port int) (string, bool) {
	// Opens a port forward TCP connection and stores it
	mu.Lock()
	defer mu.Unlock()
	if _, ok := fds[key]; ok {
		return "", false
	}
	addr := host + ":" + strconv.Itoa(port)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return "", false
	}
	fds[key] = conn
	return key, true
}

func Read(connID string, maxBytes int) []byte {
	// Reads bytes from the stored port forward connection
	mu.Lock()
	conn, ok := fds[connID]
	mu.Unlock()
	if !ok {
		return nil
	}
	buf := make([]byte, maxBytes)
	n, err := conn.Read(buf)
	if err != nil || n <= 0 {
		return nil
	}
	return buf[:n]
}

func Write(connID string, data []byte) bool {
	// Writes bytes to the stored port forward connection
	mu.Lock()
	conn, ok := fds[connID]
	mu.Unlock()
	if !ok || len(data) == 0 {
		return false
	}
	_, err := conn.Write(data)
	return err == nil
}

func Close(connID string) {
	// Closes the stored port forward connection and removes it
	mu.Lock()
	defer mu.Unlock()
	if conn, ok := fds[connID]; ok {
		_ = conn.Close()
		delete(fds, connID)
	}
}
