package relay

import (
	"encoding/json"

	"stageless/utils/network"
)

func RelayHTTPForwardDestiny(_ map[string]any, contentBody string) string {
	// Forwards the body through the http relay and builds the envelope
	if contentBody == "" {
		return ""
	}
	resp := network.RelayCall(contentBody)
	if !resp.OK || resp.Code != 200 || resp.Body == "" {
		return ""
	}
	var pkt any
	if err := json.Unmarshal([]byte(resp.Body), &pkt); err != nil {
		return ""
	}
	content := network.RelayPipeContent(pkt)
	return network.BuildEnvelope(content)
}
