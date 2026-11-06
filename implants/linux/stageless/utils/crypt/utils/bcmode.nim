# MIT License
#
# Copyright (c) 2018 Eugene Kabanov
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#
# Adapted from nimcrypto: https://github.com/cheatfate/nimcrypto

import utils

const
  MaxBlockSize = 256
  MaxBlockBytesSize = MaxBlockSize shr 3

type
  ECB*[T] = object

    cipher: T

  CBC*[T] = object

    cipher: T
    iv: array[MaxBlockBytesSize, byte]
    tmp: array[MaxBlockBytesSize, byte]

  OFB*[T] = object

    cipher: T
    iv: array[MaxBlockBytesSize, byte]

  CFB*[T] = object

    cipher: T
    iv: array[MaxBlockBytesSize, byte]

  CTR*[T] = object

    cipher: T
    iv: array[MaxBlockBytesSize, byte]
    ecount: array[MaxBlockBytesSize, byte]
    num: uint

  GCM*[T] = object

    cipher: T
    h: array[16, byte]
    y: array[16, byte]
    basectr: array[16, byte]
    buf: array[16, byte]
    hbuf: array[16, byte]
    aadlen: uint64
    datalen: uint64
    coffset: uint8

template sizeBlock*[T](ctx: ECB[T]): int =
  # Returns the ecb block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: ECB[T]): int =
  # Returns the ecb key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func init*[T](ctx: var ECB[T], key: openArray[byte]) {.inline.} =
  # Initializes an ecb context with a byte key

  mixin init
  assert(ctx.sizeBlock <= MaxBlockSize)
  assert(len(key) >= ctx.sizeKey())
  init(ctx.cipher, key)

func init*[T](ctx: var ECB[T], key: openArray[char]) {.inline.} =
  # Initializes an ecb context with a char key

  init(ctx, key.toOpenArrayByte(0, len(key) - 1))

func init*[T](ctx: var ECB[T], key: ptr byte) =
  # Initializes an ecb context from a raw key pointer

  assert(not isNil(key))
  var p = cast[ptr UncheckedArray[byte]](key)
  init(ctx.cipher, toOpenArray(p, 0, ctx.sizeKey() - 1))

func clear*[T](ctx: var ECB[T]) {.inline.} =
  # Clears the ecb context from memory

  burnMem(ctx)

func encrypt*[T](
    ctx: var ECB[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Encrypts a byte buffer in ecb mode

  mixin encrypt
  assert(len(input) <= len(output))
  assert(len(input) mod ctx.sizeBlock() == 0)
  var offset = 0
  while offset < len(input):
    ctx.cipher.encrypt(input.toOpenArray(offset, offset + ctx.sizeBlock() - 1),
                       output.toOpenArray(offset, offset + ctx.sizeBlock() - 1))
    offset = offset + ctx.sizeBlock()

func encrypt*[T](
    ctx: var ECB[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Encrypts a char buffer in ecb mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
          output.toOpenArrayByte(0, len(output) - 1))

func decrypt*[T](
    ctx: var ECB[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Decrypts a byte buffer in ecb mode

  mixin decrypt
  assert(len(input) <= len(output))
  assert(len(input) mod ctx.sizeBlock() == 0)
  var offset = 0
  while offset < len(input):
    ctx.cipher.decrypt(input.toOpenArray(offset, offset + ctx.sizeBlock() - 1),
                       output.toOpenArray(offset, offset + ctx.sizeBlock() - 1))
    offset = offset + ctx.sizeBlock()

func decrypt*[T](
    ctx: var ECB[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Decrypts a char buffer in ecb mode

  decrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

func encrypt*[T](
    ctx: var ECB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Encrypts a raw buffer in ecb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var ECB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Decrypts a raw buffer in ecb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  decrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

template sizeBlock*[T](ctx: CBC[T]): int =
  # Returns the cbc block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: CBC[T]): int =
  # Returns the cbc key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func init*[T](ctx: var CBC[T], key: openArray[byte], iv: openArray[byte]) =
  # Initializes a cbc context with a byte key and iv

  mixin init
  assert(len(iv) == ctx.sizeBlock())
  assert(len(key) >= ctx.sizeKey())
  assert(ctx.sizeBlock <= MaxBlockSize)
  init(ctx.cipher, key)
  ctx.iv[0 ..< ctx.sizeBlock()] = iv.toOpenArray(0, ctx.sizeBlock() - 1)

func init*[T](ctx: var CBC[T], key: openArray[char], iv: openArray[char]) =
  # Initializes a cbc context with a char key and iv

  init(ctx, key.toOpenArrayByte(0, len(key) - 1),
            iv.toOpenArrayByte(0, len(iv) - 1))

func init*[T](ctx: var CBC[T], key: ptr byte, iv: ptr byte) =
  # Initializes a cbc context from raw key and iv pointers

  assert(not isNil(key) and not isNil(iv))
  var pkey = cast[ptr UncheckedArray[byte]](key)
  var piv = cast[ptr UncheckedArray[byte]](iv)
  init(ctx, toOpenArray(pkey, 0, ctx.sizeKey() - 1),
            toOpenArray(piv, 0, ctx.sizeBlock() - 1))

func clear*[T](ctx: var CBC[T]) {.inline.} =
  # Clears the cbc context from memory

  burnMem(ctx)

func encrypt*[T](
    ctx: var CBC[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Encrypts a byte buffer in cbc mode

  assert(len(input) <= len(output))
  assert(len(input) mod ctx.sizeBlock() == 0)
  var offset = 0
  while offset < len(input):
    for i in 0 ..< ctx.sizeBlock():
      output[offset + i] = input[offset + i] xor ctx.iv[i]
    ctx.cipher.encrypt(output.toOpenArray(offset, offset + ctx.sizeBlock() - 1),
                       output.toOpenArray(offset, offset + ctx.sizeBlock() - 1))

    ctx.iv[0 ..< ctx.sizeBlock()] =
                        output.toOpenArray(offset, offset + ctx.sizeBlock() - 1)
    offset = offset + ctx.sizeBlock()

func encrypt*[T](
    ctx: var CBC[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Encrypts a raw buffer in cbc mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func encrypt*[T](
    ctx: var CBC[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Encrypts a char buffer in cbc mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

func decrypt*[T](
    ctx: var CBC[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Decrypts a byte buffer in cbc mode

  mixin decrypt
  assert(len(input) <= len(output))
  assert(len(input) mod ctx.sizeBlock() == 0)
  var offset = 0
  while offset < len(input):
    ctx.cipher.decrypt(input.toOpenArray(offset, offset + ctx.sizeBlock() - 1),
                       ctx.tmp)
    for i in 0 ..< ctx.sizeBlock():
      var c = input[offset + i]
      output[offset + i] = ctx.tmp[i] xor ctx.iv[i]
      ctx.iv[i] = c
    offset = offset + ctx.sizeBlock()

func decrypt*[T](
    ctx: var CBC[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Decrypts a raw buffer in cbc mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  decrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var CBC[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Decrypts a char buffer in cbc mode

  decrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

template sizeBlock*[T](ctx: CTR[T]): int =
  # Returns the ctr block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: CTR[T]): int =
  # Returns the ctr key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func inc128(counter: var openArray[byte]) =
  # Increments a 128 bit counter
  var n = 16'u32
  var c = 1'u32
  while true:
    dec(n)
    c = c + counter[n]
    counter[n] = cast[byte](c)
    c = c shr 8
    if n == 0:
      break

func inc256(counter: var openArray[byte]) =
  # Increments a 256 bit counter
  var n = 32'u32
  var c = 1'u32
  while true:
    dec(n)
    c = c + counter[n]
    counter[n] = cast[byte](c)
    c = c shr 8
    if n == 0:
      break

func init*[T](ctx: var CTR[T], key: openArray[byte], iv: openArray[byte]) =
  # Initializes a ctr context with a byte key and iv

  mixin init
  assert(len(iv) >= ctx.sizeBlock())
  assert(len(key) >= ctx.sizeKey())
  assert(ctx.sizeBlock <= MaxBlockSize)
  init(ctx.cipher, key)
  ctx.iv[0 ..< ctx.sizeBlock()] = iv.toOpenArray(0, ctx.sizeBlock() - 1)

func init*[T](ctx: var CTR[T], key: ptr byte, iv: ptr byte) =
  # Initializes a ctr context from raw key and iv pointers

  assert(not isNil(key) and not isNil(iv))
  var pkey = cast[ptr UncheckedArray[byte]](key)
  var piv = cast[ptr UncheckedArray[byte]](iv)
  init(ctx, toOpenArray(pkey, 0, ctx.sizeKey() - 1),
            toOpenArray(piv, 0, ctx.sizeBlock() - 1))

func init*[T](
    ctx: var CTR[T],
    key: openArray[char],
    iv: openArray[char]
) {.inline.} =
  # Initializes a ctr context with a char key and iv

  init(ctx, key.toOpenArrayByte(0, len(key) - 1),
            iv.toOpenArrayByte(0, len(iv) - 1))

func clear*[T](ctx: var CTR[T]) {.inline.} =
  # Clears the ctr context from memory

  burnMem(ctx)

func encrypt*[T](
    ctx: var CTR[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Encrypts a byte buffer in ctr mode

  mixin encrypt
  assert(len(input) <= len(output))
  assert(ctx.sizeBlock == (128 div 8) or ctx.sizeBlock == (256 div 8))

  var offset = 0
  var n = ctx.num
  while offset < len(input):
    if n == 0:
      ctx.cipher.encrypt(ctx.iv, ctx.ecount)
      if ctx.sizeBlock == (128 div 8):
        inc128(ctx.iv)
      elif ctx.sizeBlock == (256 div 8):
        inc256(ctx.iv)
    output[offset] = input[offset] xor ctx.ecount[n]
    inc(offset)
    n = (n + 1) mod ctx.sizeBlock()
  ctx.num = n

func encrypt*[T](
    ctx: var CTR[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Encrypts a char buffer in ctr mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

func encrypt*[T](
    ctx: var CTR[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Encrypts a raw buffer in ctr mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var CTR[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Decrypts a byte buffer in ctr mode

  encrypt(ctx, input, output)

func decrypt*[T](
    ctx: var CTR[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable, inline.} =
  # Decrypts a raw buffer in ctr mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var CTR[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Decrypts a char buffer in ctr mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

template sizeBlock*[T](ctx: OFB[T]): int =
  # Returns the ofb block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: OFB[T]): int =
  # Returns the ofb key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func init*[T](ctx: var OFB[T], key: openArray[byte], iv: openArray[byte]) =
  # Initializes an ofb context with a byte key and iv

  mixin init
  assert(len(iv) >= ctx.sizeBlock())
  assert(len(key) >= ctx.sizeKey())
  assert(ctx.sizeBlock <= MaxBlockSize)
  init(ctx.cipher, key)
  ctx.iv[0 ..< ctx.sizeBlock()] = iv.toOpenArray(0, ctx.sizeBlock() - 1)

func init*[T](ctx: var OFB[T], key: ptr byte, iv: ptr byte) =
  # Initializes an ofb context from raw key and iv pointers

  assert(not isNil(key) and not isNil(iv))
  var pkey = cast[ptr UncheckedArray[byte]](key)
  var piv = cast[ptr UncheckedArray[byte]](iv)
  init(ctx, toOpenArray(pkey, 0, ctx.sizeKey() - 1),
            toOpenArray(piv, 0, ctx.sizeBlock() - 1))

func init*[T](ctx: var OFB[T], key: openArray[char], iv: openArray[char]) =
  # Initializes an ofb context with a char key and iv

  init(ctx, key.toOpenArrayByte(0, len(key) - 1),
            iv.toOpenArrayByte(0, len(iv) - 1))

func clear*[T](ctx: var OFB[T]) {.inline.} =
  # Clears the ofb context from memory

  burnMem(ctx)

func encrypt*[T](
    ctx: var OFB[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Encrypts a byte buffer in ofb mode

  mixin encrypt
  assert(len(input) <= len(output))
  var offset = 0
  var n = 0
  while offset < len(input):
    if n == 0:
      ctx.cipher.encrypt(ctx.iv, ctx.iv)
    output[offset] = input[offset] xor ctx.iv[n]
    inc(offset)
    n = (n + 1) mod ctx.sizeBlock()

func encrypt*[T](
    ctx: var OFB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Encrypts a raw buffer in ofb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func encrypt*[T](
    ctx: var OFB[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Encrypts a char buffer in ofb mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

func decrypt*[T](
    ctx: var OFB[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Decrypts a byte buffer in ofb mode

  encrypt(ctx, input, output)

func decrypt*[T](
    ctx: var OFB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable, inline.} =
  # Decrypts a raw buffer in ofb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var OFB[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Decrypts a char buffer in ofb mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

template sizeBlock*[T](ctx: CFB[T]): int =
  # Returns the cfb block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: CFB[T]): int =
  # Returns the cfb key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func init*[T](ctx: var CFB[T], key: openArray[byte], iv: openArray[byte]) =
  # Initializes a cfb context with a byte key and iv

  mixin init
  assert(len(iv) >= ctx.sizeBlock())
  assert(len(key) >= ctx.sizeKey())
  assert(ctx.sizeBlock <= MaxBlockSize)
  init(ctx.cipher, key)
  ctx.iv[0 ..< ctx.sizeBlock()] = iv.toOpenArray(0, ctx.sizeBlock() - 1)

func init*[T](ctx: var CFB[T], key: ptr byte, iv: ptr byte) =
  # Initializes a cfb context from raw key and iv pointers

  assert(not isNil(key) and not isNil(iv))
  var pkey = cast[ptr UncheckedArray[byte]](key)
  var piv = cast[ptr UncheckedArray[byte]](iv)
  init(ctx, toOpenArray(pkey, 0, ctx.sizeKey() - 1),
            toOpenArray(piv, 0, ctx.sizeBlock() - 1))

func init*[T](ctx: var CFB[T], key: openArray[char], iv: openArray[char]) =
  # Initializes a cfb context with a char key and iv

  init(ctx, key.toOpenArrayByte(0, len(key) - 1),
            iv.toOpenArrayByte(0, len(iv) - 1))

func clear*[T](ctx: var CFB[T]) {.inline.} =
  # Clears the cfb context from memory

  burnMem(ctx)

func encrypt*[T](
    ctx: var CFB[T],
    input: openArray[byte],
    output: var openArray[byte]
) {.inline.} =
  # Encrypts a byte buffer in cfb mode

  mixin encrypt
  assert(len(input) <= len(output))
  var offset = 0
  var n = 0
  while offset < len(input):
    if n == 0:
      ctx.cipher.encrypt(ctx.iv, ctx.iv)
    ctx.iv[n] = ctx.iv[n] xor input[offset]
    output[offset] = ctx.iv[n]
    inc(offset)
    n = (n + 1) mod ctx.sizeBlock()

func encrypt*[T](
    ctx: var CFB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Encrypts a raw buffer in cfb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  encrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func encrypt*[T](
    ctx: var CFB[T],
    input: openArray[char],
    output: var openArray[char]
) {.inline.} =
  # Encrypts a char buffer in cfb mode

  encrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

func decrypt*[T](
    ctx: var CFB[T],
    input: openArray[byte],
    output: var openArray[byte]
) =
  # Decrypts a byte buffer in cfb mode

  mixin encrypt
  assert(len(input) <= len(output))
  var n = 0
  var offset = 0
  while offset < len(input):
    if n == 0:
      ctx.cipher.encrypt(ctx.iv, ctx.iv)
    let c = input[offset]
    output[offset] = ctx.iv[n] xor c
    ctx.iv[n] = c
    inc(offset)
    n = (n + 1) mod ctx.sizeBlock()

func decrypt*[T](
    ctx: var CFB[T],
    inp: ptr byte,
    oup: ptr byte,
    length: uint
): uint {.discardable.} =
  # Decrypts a raw buffer in cfb mode

  var ip = cast[ptr UncheckedArray[byte]](inp)
  var op = cast[ptr UncheckedArray[byte]](oup)
  decrypt(ctx, toOpenArray(ip, 0, int(length - 1)),
               toOpenArray(op, 0, int(length - 1)))
  result = length

func decrypt*[T](
    ctx: var CFB[T],
    input: openArray[char],
    output: var openArray[char]
) =
  # Decrypts a char buffer in cfb mode

  decrypt(ctx, input.toOpenArrayByte(0, len(input) - 1),
               output.toOpenArrayByte(0, len(output) - 1))

const
  GCMBlockSize = 128 div 8

func bmul64(x, y: uint64): uint64 =
  # Multiplies two 64 bit values without carry
  var x0, x1, x2, x3, y0, y1, y2, y3, z0, z1, z2, z3: uint64
  x0 = x and 0x1111111111111111'u64
  x1 = x and 0x2222222222222222'u64
  x2 = x and 0x4444444444444444'u64
  x3 = x and 0x8888888888888888'u64
  y0 = y and 0x1111111111111111'u64
  y1 = y and 0x2222222222222222'u64
  y2 = y and 0x4444444444444444'u64
  y3 = y and 0x8888888888888888'u64
  z0 = (x0 * y0) xor (x1 * y3) xor (x2 * y2) xor (x3 * y1)
  z1 = (x0 * y1) xor (x1 * y0) xor (x2 * y3) xor (x3 * y2)
  z2 = (x0 * y2) xor (x1 * y1) xor (x2 * y0) xor (x3 * y3)
  z3 = (x0 * y3) xor (x1 * y2) xor (x2 * y1) xor (x3 * y0)
  z0 = z0 and 0x1111111111111111'u64
  z1 = z1 and 0x2222222222222222'u64
  z2 = z2 and 0x4444444444444444'u64
  z3 = z3 and 0x8888888888888888'u64
  result = z0 or z1 or z2 or z3

template RMS(x, m, s) =
  # Shifts masked bits inside a word
  x = ((x and uint64(m)) shl (s)) or ((x shr (s)) and uint64(m))

func rev64(x: uint64): uint64 =
  # Reverses the bits of a 64 bit value
  var xx = x
  RMS(xx, 0x5555555555555555'u64, 1)
  RMS(xx, 0x3333333333333333'u64, 2)
  RMS(xx, 0x0F0F0F0F0F0F0F0F'u64, 4)
  RMS(xx, 0x00FF00FF00FF00FF'u64, 8)
  RMS(xx, 0x0000FFFF0000FFFF'u64, 16)
  result = (xx shl 32) or (xx shr 32)

func ghash(
    y: var openArray[byte],
    h: openArray[byte],
    data: openArray[byte]
) =
  # Mixes data into the ghash state
  var  y0, y1, h0, h1, h2, h0r, h1r, h2r: uint64

  y1 = beLoad64(y, 0)
  y0 = beLoad64(y, 8)
  h1 = beLoad64(h, 0)
  h0 = beLoad64(h, 8)
  h0r = rev64(h0)
  h1r = rev64(h1)
  h2 = h0 xor h1
  h2r = h0r xor h1r

  var length = len(data)
  var offset = 0
  while length > 0:
    var tmp: array[16, byte]
    var y0r, y1r, y2, y2r: uint64
    var z0, z1, z2, z0h, z1h, z2h, v0, v1, v2, v3: uint64

    if length >= 16:
      y1 = y1 xor beLoad64(data, offset)
      y0 = y0 xor beLoad64(data, offset + 8)
      dec(length, 16)
      inc(offset, 16)
    else:
      tmp[0 ..< length] = data.toOpenArray(offset, offset + length - 1)
      y1 = y1 xor beLoad64(tmp, 0)
      y0 = y0 xor beLoad64(tmp, 8)
      length = 0

    y0r = rev64(y0)
    y1r = rev64(y1)
    y2 = y0 xor y1;
    y2r = y0r xor y1r;

    z0 = bmul64(y0, h0)
    z1 = bmul64(y1, h1)
    z2 = bmul64(y2, h2)
    z0h = bmul64(y0r, h0r)
    z1h = bmul64(y1r, h1r)
    z2h = bmul64(y2r, h2r)
    z2 = z2 xor (z0 xor z1)
    z2h = z2h xor (z0h xor z1h)
    z0h = rev64(z0h) shr 1
    z1h = rev64(z1h) shr 1
    z2h = rev64(z2h) shr 1

    v0 = z0
    v1 = z0h xor z2
    v2 = z1 xor z2h
    v3 = z1h

    v3 = (v3 shl 1) or (v2 shr 63)
    v2 = (v2 shl 1) or (v1 shr 63)
    v1 = (v1 shl 1) or (v0 shr 63)
    v0 = (v0 shl 1)

    v2 = v2 xor (v0 xor (v0 shr 1) xor (v0 shr 2) xor (v0 shr 7))
    v1 = v1 xor ((v0 shl 63) xor (v0 shl 62) xor (v0 shl 57))
    v3 = v3 xor (v1 xor (v1 shr 1) xor (v1 shr 2) xor (v1 shr 7))
    v2 = v2 xor ((v1 shl 63) xor (v1 shl 62) xor (v1 shl 57))

    y0 = v2
    y1 = v3

  beStore64(y, 0, y1)
  beStore64(y, 8, y0)

template sizeBlock*[T](ctx: GCM[T]): int =
  # Returns the gcm block size

  mixin sizeBlock
  sizeBlock(ctx.cipher)

template sizeKey*[T](ctx: GCM[T]): int =
  # Returns the gcm key size

  mixin sizeKey
  sizeKey(ctx.cipher)

func init*[T](
    ctx: var GCM[T],
    key: openArray[byte],
    iv: openArray[byte],
    aad: openArray[byte]
) =
  # Initializes a gcm context with the key, nonce, and extra data

  mixin init

  doAssert(ctx.sizeBlock() == GCMBlockSize)
  doAssert(len(key) >= ctx.sizeKey())
  burnMem(ctx)
  ctx.cipher.init(key)
  ctx.cipher.encrypt(ctx.h, ctx.h)
  if len(iv) == 12:
    ctx.y[0 ..< 12] = iv.toOpenArray(0, 11)
    inc128(ctx.y)
  else:
    var tmp: array[GCMBlockSize, byte]
    ghash(ctx.y, ctx.h, iv)
    beStore32(tmp, 12, uint32(len(iv) shl 3))
    ghash(ctx.y, ctx.h, tmp.toOpenArray(0, GCMBlockSize - 1))
  ctx.cipher.encrypt(ctx.y, ctx.basectr)
  ctx.aadlen = uint64(len(aad))
  ctx.datalen = 0
  if len(aad) > 0:
    ghash(ctx.buf, ctx.h, aad)

func encrypt*[T](
    ctx: var GCM[T],
    input: openArray[byte],
    output: var openArray[byte]
) =
  # Encrypts a byte buffer in gcm mode

  mixin encrypt
  doAssert(len(input) <= len(output))

  var
    ectr: array[GCMBlockSize, byte]
    length = len(input)
    offset = 0

  while length > 0:
    let uselen =
      if int(ctx.coffset) + length < GCMBlockSize:
        length
      else:
        GCMBlockSize - int(ctx.coffset)
    if ctx.coffset == 0:
      inc128(ctx.y)
    ctx.cipher.encrypt(ctx.y, ectr)
    for i in 0 ..< uselen:
      let ch = ectr[int(ctx.coffset) + i] xor input[offset + i]
      output[offset + i] = ch
      ctx.hbuf[int(ctx.coffset) + i] = ch
    length -= uselen
    offset += uselen
    ctx.coffset = (ctx.coffset + uint8(uselen)) and uint8(GCMBlockSize - 1)
    if ctx.coffset == 0:
      ghash(ctx.buf, ctx.h, ctx.hbuf.toOpenArray(0, GCMBlockSize - 1))

  ctx.datalen += uint64(len(input))

func decrypt*[T](
    ctx: var GCM[T],
    input: openArray[byte],
    output: var openArray[byte]
) =
  # Decrypts a byte buffer in gcm mode

  mixin encrypt
  doAssert(len(input) <= len(output))

  var
    ectr: array[GCMBlockSize, byte]
    length = len(input)
    offset = 0

  while length > 0:
    let uselen =
      if int(ctx.coffset) + length < GCMBlockSize:
        length
      else:
        GCMBlockSize - int(ctx.coffset)
    if ctx.coffset == 0:
      inc128(ctx.y)
    ctx.cipher.encrypt(ctx.y, ectr)
    for i in 0 ..< uselen:
      let ch = ectr[int(ctx.coffset) + i] xor input[offset + i]
      ctx.hbuf[int(ctx.coffset) + i] = input[offset + i]
      output[offset + i] = ch
    length -= uselen
    offset += uselen
    ctx.coffset = (ctx.coffset + uint8(uselen)) and uint8(GCMBlockSize - 1)
    if ctx.coffset == 0:
      ghash(ctx.buf, ctx.h, ctx.hbuf.toOpenArray(0, GCMBlockSize - 1))

  ctx.datalen += uint64(len(input))

func getTag*[T](
    ctx: var GCM[T],
    tag: var openArray[byte]
) =
  # Writes the gcm authentication tag

  var workbuf: array[GCMBlockSize, byte]
  let
    taglen = len(tag)
    uselen = if taglen < GCMBlockSize: taglen else: GCMBlockSize

  if ctx.coffset != 0:
    ghash(ctx.buf, ctx.h, ctx.hbuf.toOpenArray(0, int(ctx.coffset) - 1))

  if taglen > 0:
    copyMem(tag, 0, ctx.basectr, 0, uselen)
  beStore64(workbuf, 0, ctx.aadlen shl 3)
  beStore64(workbuf, 8, ctx.datalen shl 3)
  ghash(ctx.buf, ctx.h, workbuf)
  for i in 0 ..< uselen:
    tag[i] = tag[i] xor ctx.buf[i]

func getTag*[T](ctx: var GCM[T]): array[GCMBlockSize, byte] {.noinit.} =
  # Returns the gcm authentication tag

  getTag(ctx, result)

func encrypt*[T](
    ctx: var GCM[T],
    input: openArray[byte],
    output: var openArray[byte],
    tag: var openArray[byte]
) =
  # Encrypts a buffer and writes the gcm tag

  ctx.encrypt(input, output)
  ctx.getTag(tag)

func decrypt*[T](
    ctx: var GCM[T],
    input: openArray[byte],
    output: var openArray[byte],
    tag: openArray[byte]
): bool =
  # Decrypts a buffer and checks the gcm tag

  var dataTag: array[GCMBlockSize, byte]
  let uselen = min(len(tag), GCMBlockSize)
  ctx.decrypt(input, output)
  ctx.getTag(dataTag.toOpenArray(0, uselen - 1))
  equalMemFull(
    tag.toOpenArray(0, uselen - 1), dataTag.toOpenArray(0, uselen - 1))

func clear*[T](ctx: var GCM[T]) {.inline.} =
  # Clears the gcm context from memory

  burnMem(ctx)
