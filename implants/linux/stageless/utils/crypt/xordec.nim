proc fromXor*(enc: openArray[byte]; key: int): string =
  # Decrypts bytes with a rolling xor key
  result = newString(enc.len)
  for i, b in enc:
    result[i] = char(byte(b) xor byte((key + i) and 0xFF))
