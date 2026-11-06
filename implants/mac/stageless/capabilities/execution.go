package capabilities

const bufCap = 1024 * 1024 * 1024

func WriteMsg(msg string) []byte {
	// Returns the message as bytes when it fits the buffer
	if len(msg) > bufCap {
		return nil
	}
	return []byte(msg)
}
