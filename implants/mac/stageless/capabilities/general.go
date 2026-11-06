package capabilities

import (
	"strconv"
	"strings"

	"stageless/utils"
	"stageless/utils/obf"
)

func RunConfig(args string) []byte {
	// Builds the current beacon config and returns it as text
	_ = args
	sec := global.BeaconDelay
	if sec <= 0 {
		sec = 5
	}
	msg := obf.S("channel: ") + global.Channel + "\n" +
		obf.S("host: ") + global.Host + "\n" +
		obf.S("port: ") + global.Port + "\n" +
		obf.S("path: ") + global.Path + "\n" +
		obf.S("tag: ") + global.HostTag + "\n" +
		obf.S("delay: ") + strconv.Itoa(sec) + "\n" +
		obf.S("pipeline: ") + global.PipelineTarget + "\n" +
		obf.S("workers: ") + strconv.Itoa(int(global.BgWorkers))
	return WriteMsg(msg)
}

func RunDelay(args string) []byte {
	// Receives the delay in seconds and stores it
	line := strings.TrimSpace(args)
	if line == "" {
		return WriteMsg(obf.S("Error: usage delay <seconds>"))
	}
	sec, err := strconv.Atoi(line)
	if err != nil || sec < 0 {
		return WriteMsg(obf.S("Error: invalid delay"))
	}
	global.BeaconDelay = sec
	return WriteMsg(obf.S("Delay set to ") + strconv.Itoa(sec) + obf.S(" seconds."))
}
