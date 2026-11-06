proc fromXor*(enc: openArray[byte]; key: int): string =
  # Decodes xor bytes with a key offset by the index
  result = newString(enc.len)
  for i, b in enc:
    result[i] = char(byte(b) xor byte((key + i) and 0xFF))
