package network

const (
	FrameChunkSize = 60 * 1024
	frameMoreFlag  = 0x80000000
)

func frameHdrEncode(pieceLen int, more bool) int {
	// Encodes the piece length and the more flag into the header
	if more {
		return pieceLen | frameMoreFlag
	}
	return pieceLen
}

func framePieceLen(raw int) int {
	// Returns the piece length from the raw header
	return raw &^ frameMoreFlag
}

func frameHasMore(raw int) bool {
	// Checks that the raw header still has more pieces
	return raw&frameMoreFlag != 0
}

func frameHdrToBE(v int) [4]byte {
	// Writes the header value as four big endian bytes
	return [4]byte{
		byte((v >> 24) & 0xFF),
		byte((v >> 16) & 0xFF),
		byte((v >> 8) & 0xFF),
		byte(v & 0xFF),
	}
}

func frameHdrFromBE(hdr [4]byte) int {
	// Reads the header value from four big endian bytes
	return int(hdr[0])<<24 | int(hdr[1])<<16 | int(hdr[2])<<8 | int(hdr[3])
}
