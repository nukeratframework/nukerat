package obf

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"time"
)

const Type = "<obfuscationType>"

func S(data string) string {
	// Main function that decodes a string according to the obfuscation type
	switch Type {
	case "xor":
		key := xorKey()
		out := make([]byte, len(data))
		for i := 0; i < len(data); i++ {
			out[i] = data[i] ^ byte((key+i)&0xFF)
		}
		return string(out)
	case "rc4":
		key := rc4Key()
		return rc4Decrypt(key, data)
	default:
		return data
	}
}

func xorKey() int {
	// Builds an integer xor key from the current time
	sum := md5.Sum([]byte(strconv.FormatInt(time.Now().UnixNano(), 10)))
	return int(sum[0]) | int(sum[1])<<8 | int(sum[2])<<16 | int(sum[3])<<24
}

func rc4Key() string {
	// Builds a hex rc4 key from the current time
	return hex.EncodeToString(md5Sum(strconv.FormatInt(time.Now().UnixNano(), 10)))
}

func md5Sum(s string) []byte {
	// Returns the md5 bytes of a string
	h := md5.Sum([]byte(s))
	return h[:]
}

func rc4Decrypt(key, enc string) string {
	// Decrypts the encoded string with rc4 using the given key
	var s [256]int
	for i := 0; i < 256; i++ {
		s[i] = i
	}
	j := 0
	for i := 0; i < 256; i++ {
		j = (j + s[i] + int(key[i%len(key)])) % 256
		s[i], s[j] = s[j], s[i]
	}
	x, y := 0, 0
	out := make([]byte, len(enc))
	for i := 0; i < len(enc); i++ {
		x = (x + 1) % 256
		y = (y + s[x]) % 256
		s[x], s[y] = s[y], s[x]
		k := s[(s[x]+s[y])%256]
		out[i] = enc[i] ^ byte(k)
	}
	return string(out)
}

func RandomProbe(n int) (string, error) {
	// Builds a random alphanumeric string of the requested length
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, n)
	for i, b := range buf {
		out[i] = chars[int(b)%len(chars)]
	}
	return string(out), nil
}