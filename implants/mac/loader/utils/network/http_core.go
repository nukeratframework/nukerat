package network

import (
	"crypto/tls"
	"io"
	"net/http"
	"strings"
	"time"
	global "loader/utils"
	"loader/utils/obf"
)

type HTTPResponse struct {
	OK   bool
	Code uint16
	Body string
}

func HTTPGetRaw() HTTPResponse {
	// Sends a raw HTTP GET to the configured URL and returns the status and body
	if global.Url == "" {
		return HTTPResponse{}
	}
	req, err := http.NewRequest(http.MethodGet, global.Url, nil)
	if err != nil {
		return HTTPResponse{}
	}
	req.Header.Set(obf.S("User-Agent"), obf.S("Mozilla/5.0"))
	req.Header.Set(obf.S("Connection"), obf.S("close"))
	client := &http.Client{Timeout: 60 * time.Second}
	if strings.HasPrefix(global.Url, obf.S("https://")) {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return HTTPResponse{}
	}
	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return HTTPResponse{OK: true, Code: uint16(resp.StatusCode)}
	}
	return HTTPResponse{
		OK:   true,
		Code: uint16(resp.StatusCode),
		Body: string(rawBody),
	}
}
