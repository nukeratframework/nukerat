import std/sysrand

import ../global
import ./utils/rijndael
import ./utils/bcmode

const AesKeySize* = 32
const AesNonceSize* = 12
const AesTagSize* = 16

proc aesEncrypt*(key, plaintext: openArray[byte]): seq[byte] =
  # Encrypts plaintext with the aes key and returns nonce, ciphertext, and tag
  if key.len != AesKeySize:
    raise newException(ValueError, obf("aes key must be 32 bytes"))
  var nonce: array[AesNonceSize, byte]
  if not urandom(nonce):
    raise newException(OSError, obf("urandom failed"))

  var ctx: GCM[aes256]
  var enc = newSeq[byte](plaintext.len)
  var tag: array[AesTagSize, byte]
  ctx.init(key, nonce, @[])
  if plaintext.len > 0:
    ctx.encrypt(plaintext, enc)
  ctx.getTag(tag)
  ctx.clear()

  result = newSeq[byte](AesNonceSize + enc.len + AesTagSize)
  copyMem(addr result[0], addr nonce[0], AesNonceSize)
  if enc.len > 0:
    copyMem(addr result[AesNonceSize], addr enc[0], enc.len)
  copyMem(addr result[AesNonceSize + enc.len], addr tag[0], AesTagSize)

proc aesDecrypt*(key, blob: openArray[byte]): seq[byte] =
  # Decrypts an aes blob with the aes key and returns the plaintext
  if key.len != AesKeySize:
    raise newException(ValueError, obf("aes key must be 32 bytes"))
  let overhead = AesNonceSize + AesTagSize
  if blob.len < overhead:
    raise newException(ValueError, obf("aes blob too short"))

  let ctLen = blob.len - overhead
  let tagStart = blob.len - AesTagSize

  var ctx: GCM[aes256]
  result = newSeq[byte](ctLen)
  ctx.init(key, blob.toOpenArray(0, AesNonceSize - 1), @[])
  let ok =
    if ctLen > 0:
      ctx.decrypt(
        blob.toOpenArray(AesNonceSize, blob.len - AesTagSize - 1),
        result,
        blob.toOpenArray(tagStart, blob.high)
      )
    else:
      var noCt: array[0, byte]
      ctx.decrypt(noCt, result, blob.toOpenArray(tagStart, blob.high))
  ctx.clear()
  if not ok:
    raise newException(ValueError, obf("aes decrypt failed"))
