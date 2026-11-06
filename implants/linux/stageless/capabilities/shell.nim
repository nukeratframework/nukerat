import ../utils/global
import ../utils/linapi/handlers
import execution

proc run_shell*(args: string; buf: var openArray[char]): int =
  # Entrypoint that runs a shell command
  if args.len == 0:
    return writeMsg(obf("Error: empty command"), buf)
  execPosix(args, "", buf)
