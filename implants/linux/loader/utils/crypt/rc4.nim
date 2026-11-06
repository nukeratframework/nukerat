proc fromRC4*(key, enc: string): string =
  # Decrypts an rc4 string with the given key
  var s: array[256, int]
  for i in 0..255: s[i] = i
  var j = 0
  for i in 0..255:
    j = (j + s[i] + ord(key[i mod key.len])) mod 256
    swap(s[i], s[j])
  var x, y = 0
  for i in 0 ..< enc.len:
    x = (x + 1) mod 256
    y = (y + s[x]) mod 256
    swap(s[x], s[y])
    let k = (s[x] + s[y]) mod 256
    result.add char(ord(enc[i]) xor s[k])
