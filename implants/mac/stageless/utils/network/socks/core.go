package socks

import (
	"net"
	"strconv"
	"sync"
)

var (
	mu  sync.Mutex
	fds = map[string]net.Conn{}
)

func Connect(host string, port int) (string, bool) {
	// Opens a socks TCP connection and stores it by host and port
	key := host + ":" + strconv.Itoa(port)
	mu.Lock()
	defer mu.Unlock()
	if _, ok := fds[key]; ok {
		return "", false
	}
	conn, err := net.Dial("tcp", key)
	if err != nil {
		return "", false
	}
	fds[key] = conn
	return key, true
}

func Read(connID string, maxBytes int) []byte {
	// Reads bytes from the stored socks connection
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
	// Writes bytes to the stored socks connection
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
	// Closes the stored socks connection and removes it
	mu.Lock()
	defer mu.Unlock()
	if conn, ok := fds[connID]; ok {
		_ = conn.Close()
		delete(fds, connID)
	}
}
