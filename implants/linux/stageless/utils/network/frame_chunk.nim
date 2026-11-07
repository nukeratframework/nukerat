const
  frameChunkSize* = 60 * 1024
  frameMoreFlag* = 0x80000000'i32

proc frameHdrEncode*(pieceLen: int, more: bool): int =
  # Encodes the piece length and the more flag into one header value
  pieceLen or (if more: frameMoreFlag.int else: 0)

proc framePieceLen*(raw: int): int =
  # Returns the piece length stored in the header value
  raw and (not frameMoreFlag.int)

proc frameHasMore*(raw: int): bool =
  # Checks that the header value has the more flag set
  (raw and frameMoreFlag.int) != 0

proc frameHdrToBE*(v: int): array[4, char] =
  # Writes the header value as four big endian bytes
  result[0] = char((v shr 24) and 0xFF)
  result[1] = char((v shr 16) and 0xFF)
  result[2] = char((v shr 8) and 0xFF)
  result[3] = char(v and 0xFF)

proc frameHdrFromBE*(hdr: openArray[char]): int =
  # Reads a header value from four big endian bytes
  (hdr[0].int shl 24) or (hdr[1].int shl 16) or (hdr[2].int shl 8) or hdr[3].int
