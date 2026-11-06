import ../utils/global
import ../utils/winapi/handlers
import ../utils/winapi/syscall
import execution/core

proc run_kill*(buf: var openArray[char]): int =
  # Terminates the current process
  if terminateProcess(currentProcess, 0) == 0:
    return writeErr(obf("terminate process failed"), buf)
  0
