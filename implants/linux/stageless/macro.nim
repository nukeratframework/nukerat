{.push warning[Deprecated]: off.}
import macros, std/md5, times, hashes
{.pop.}

macro obf*(data: static[string]): untyped =
  # Here is where a static string is obfuscated at compile time
  when obfuscationType == "off":
    result = newLit(data)
  elif obfuscationType == "xor":
    let key = hash(getMD5($cpuTime()))
    var enc = nnkBracket.newTree()
    for i in 0 ..< data.len:
      enc.add newLit(byte(ord(data[i]) xor ((key + i) and 0xFF)))
    let keyLit = newLit(key)
    result = quote do:
      fromXor(`enc`, `keyLit`)
  elif obfuscationType == "rc4":
    let key = getMD5($cpuTime())
    let enc = fromRC4(key, data)
    let keyLit = newLit(key)
    let encLit = newLit(enc)
    result = quote do:
      fromRC4(`keyLit`, `encLit`)
  elif obfuscationType == "<obfuscationType>":
    result = newLit(data)
  else:
    {.error: "obfuscationType must be off, xor or rc4".}
