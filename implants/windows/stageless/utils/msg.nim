from std/strutils import toHex, toLowerAscii
import global

proc compactStatusHex(status: culong): string =
  # Strips leading zeros from the status hex text
  var h = toHex(status).toLowerAscii()
  while h.len > 1 and h[0] == '0':
    h = h[1 .. ^1]
  h

proc errorText*(detail: string; status: culong = 0'u32): string =
  # Builds the error text from the detail and the status code
  if status != 0'u32:
    result =
      obf("Error ") & $int(status) & obf(" (0x") & compactStatusHex(status) & obf("): ") & detail
  else:
    result = obf("Error: ") & detail

proc writeMsg*(msg: string; buf: var openArray[char]): int =
  # Writes the message into the output buffer
  if msg.len > buf.len: return -1
  if msg.len > 0: copyMem(addr buf[0], unsafeAddr msg[0], msg.len)
  msg.len

proc writeErr*(detail: string; buf: var openArray[char]; status: culong = 0'u32): int =
  # Writes the formatted error text into the output buffer
  writeMsg(errorText(detail, status), buf)
