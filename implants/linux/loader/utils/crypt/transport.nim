import std/base64
import std/md5
import std/sysrand

import ../global
import ./aes

const AesProbePlainLen* = 9
const AesProbeWireLen* = AesNonceSize + AesProbePlainLen + AesTagSize

proc keyBytes(keyB64: string): array[AesKeySize, byte] =
  # Decodes a base64 aes key into raw bytes
  let decoded = decode(keyB64)
  if decoded.len != AesKeySize:
    raise newException(ValueError, obf("invalid aes key length"))
  var key: array[AesKeySize, byte]
  copyMem(addr key[0], addr decoded[0], AesKeySize)
  key

proc randomProbe(): string =
  # Builds a random alphanumeric probe string
  const chars = obf("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
  result = newString(AesProbePlainLen)
  var buf: array[AesProbePlainLen, byte]
  if not urandom(buf):
    raise newException(OSError, obf("urandom failed"))
  for i in 0 ..< AesProbePlainLen:
    result[i] = chars[int(buf[i]) mod chars.len]

proc bytesToString*(data: openArray[byte]): string =
  # Copies raw bytes into a string
  result = newString(data.len)
  if data.len > 0:
    copyMem(addr result[0], addr data[0], data.len)

proc cryptEncryptKey*(keyB64: string; plain: string): string =
  # Encrypts plaintext with a base64 aes key
  if plain.len == 0:
    return ""
  try:
    let enc = aesEncrypt(keyBytes(keyB64), plain.toOpenArrayByte(0, plain.high))
    result = bytesToString(enc)
  except CatchableError:
    result = ""

proc cryptEncryptWithProbe*(keyB64: string; plain: string): string =
  # Encrypts a random probe and the plaintext with a base64 aes key
  if plain.len == 0:
    return ""
  try:
    let key = keyBytes(keyB64)
    let probe = randomProbe()
    let encProbe = aesEncrypt(key, probe.toOpenArrayByte(0, probe.high))
    let encPayload = aesEncrypt(key, plain.toOpenArrayByte(0, plain.high))
    result = bytesToString(encProbe) & bytesToString(encPayload)
  except CatchableError:
    result = ""

proc tryCryptDecrypt*(keyB64: string; cipher: string): string =
  # Decrypts ciphertext with a base64 aes key
  if cipher.len == 0:
    return ""
  try:
    let plain = aesDecrypt(keyBytes(keyB64), cipher.toOpenArrayByte(0, cipher.high))
    result = bytesToString(plain)
  except CatchableError:
    result = ""

proc aesRelayKeyFingerprint*(): string =
  # Returns a short md5 fingerprint of the aes relay key
  try:
    let key = keyBytes(aesRelayKey)
    var raw = newString(AesKeySize)
    copyMem(addr raw[0], addr key[0], AesKeySize)
    getMD5(raw)[0 ..< 8]
  except CatchableError:
    obf("badkey")

proc cryptEncrypt*(plain: string): string =
  # Encrypts plaintext with the aes relay key
  cryptEncryptKey(aesRelayKey, plain)

proc cryptDecrypt*(cipher: string): string =
  # Decrypts ciphertext with the aes relay key
  tryCryptDecrypt(aesRelayKey, cipher)

