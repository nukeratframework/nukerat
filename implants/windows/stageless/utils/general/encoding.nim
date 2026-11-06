import ../global

const pngSig: array[8, byte] = [137'u8, 80'u8, 78'u8, 71'u8, 13'u8, 10'u8, 26'u8, 10'u8]

proc be32(n: uint32): array[4, byte] =
  [byte((n shr 24) and 0xFF'u32), byte((n shr 16) and 0xFF'u32), byte((n shr 8) and 0xFF'u32), byte(n and 0xFF'u32)]

proc crc32(data: openArray[byte]): uint32 =
  var c = 0xFFFFFFFF'u32
  for b in data:
    c = c xor uint32(b)
    for _ in 0..7:
      if (c and 1'u32) != 0:
        c = (c shr 1) xor 0xEDB88320'u32
      else:
        c = c shr 1
  not c

proc adler32(data: openArray[byte]): uint32 =
  var a = 1'u32
  var b = 0'u32
  for ch in data:
    a = (a + uint32(ch)) mod 65521'u32
    b = (b + a) mod 65521'u32
  (b shl 16) or a

proc appendChunk(dst: var seq[byte]; chunkType: cstring; data: openArray[byte]) =
  let start = dst.len
  dst.setLen(start + 4 + 4 + data.len + 4)
  let ln = be32(uint32(data.len))
  for i in 0..3: dst[start + i] = ln[i]
  for i in 0..3: dst[start + 4 + i] = byte(ord(chunkType[i]))
  if data.len > 0:
    copyMem(addr dst[start + 8], unsafeAddr data[0], data.len)
  var crcInput = newSeq[byte](4 + data.len)
  for i in 0..3:
    crcInput[i] = byte(ord(chunkType[i]))
  if data.len > 0:
    copyMem(addr crcInput[4], unsafeAddr data[0], data.len)
  let c = crc32(crcInput)
  let crcOff = start + 8 + data.len
  let beC = be32(c)
  for i in 0..3: dst[crcOff + i] = beC[i]

proc zlibStore(data: openArray[byte]): seq[byte] =
  result = @[byte(0x78), byte(0x01)]
  var pos = 0
  while pos < data.len:
    let rem = data.len - pos
    let chunkLen = if rem > 65535: 65535 else: rem
    let final = pos + chunkLen >= data.len
    let off = result.len
    result.setLen(off + 5 + chunkLen)
    result[off] = if final: byte(1) else: byte(0)
    result[off + 1] = byte(chunkLen and 0xFF)
    result[off + 2] = byte((chunkLen shr 8) and 0xFF)
    let nlen = chunkLen xor 0xFFFF
    result[off + 3] = byte(nlen and 0xFF)
    result[off + 4] = byte((nlen shr 8) and 0xFF)
    copyMem(addr result[off + 5], unsafeAddr data[pos], chunkLen)
    pos += chunkLen
  let ad = adler32(data)
  result.add byte((ad shr 24) and 0xFF'u32)
  result.add byte((ad shr 16) and 0xFF'u32)
  result.add byte((ad shr 8) and 0xFF'u32)
  result.add byte(ad and 0xFF'u32)

proc bgraToRgbRows(px: openArray[byte]; w, h, stride: int): seq[byte] =
  result.setLen(h * (1 + w * 3))
  var di = 0
  for y in 0..<h:
    result[di] = 0
    inc di
    let rowStart = y * stride
    for x in 0..<w:
      let si = rowStart + x * 4
      result[di] = px[si + 2]
      result[di + 1] = px[si + 1]
      result[di + 2] = px[si]
      di += 3

proc encodePngRgb*(px: openArray[byte]; w, h, stride: int): seq[byte] =
  let rows = bgraToRgbRows(px, w, h, stride)
  let idat = zlibStore(rows)
  for b in pngSig:
    result.add b
  var ihdr = newSeq[byte](13)
  let beW = be32(uint32(w))
  let beH = be32(uint32(h))
  for i in 0..3: ihdr[i] = beW[i]
  for i in 0..3: ihdr[4 + i] = beH[i]
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  appendChunk(result, "IHDR", ihdr)
  appendChunk(result, "IDAT", idat)
  appendChunk(result, "IEND", [])
