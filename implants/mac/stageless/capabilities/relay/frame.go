package relay

import (
	"encoding/json"

	global "stageless/utils"
	"stageless/utils/network"
	"stageless/utils/obf"
)

type RelayForwardFunc func(cfg map[string]any, body string) string

func ProcessRelayFrame(cfg map[string]any, frame string, forward RelayForwardFunc) string {
	// Here is where a relay frame is parsed and forwarded
	if frame == "" {
		return ""
	}
	var packet map[string]any
	if err := json.Unmarshal([]byte(frame), &packet); err != nil {
		return ""
	}
	if _, ok := packet[obf.S("source")]; !ok {
		return ""
	}
	if _, ok := packet[obf.S("content")]; !ok {
		return ""
	}
	destinyKind, _ := cfg[obf.S("destinyKind")].(string)
	var result string
	if destinyKind == obf.S("server") {
		contentJSON, err := json.Marshal(packet[obf.S("content")])
		if err != nil {
			return ""
		}
		if global.Channel == obf.S("custom") {
			result = RelayHTTPCustomForwardDestiny(cfg, string(contentJSON))
		} else {
			result = RelayHTTPForwardDestiny(cfg, string(contentJSON))
		}
	} else {
		body := network.ExtendEnvelope(packet)
		result = forward(cfg, body)
	}
	return network.RelayNormalizeFrame(result)
}
